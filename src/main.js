import {createPanel} from './panel';
import {createBoard} from './panel/board';
import dati from './data';
import {createModel} from './model/state';
import {$, crea, svg, pulsante} from './ui/dom';
import './styles/app.css';
import './styles/simulations.css';
import './styles/chip-simulations.css';
import {creaSimulazioni} from './simulations/panel.ts';

// Three.js si carica solo nella pagina 3D.
const creaRenderer3d = document.documentElement.dataset.view === '3d' ? (await import('./three/renderer3d.js')).creaRenderer3d : null;

const VISTA_3D = document.documentElement.dataset.view === '3d';
const riduciMovimento = matchMedia('(prefers-reduced-motion: reduce)');
const stretto = matchMedia('(max-width: 1099px)');
const preciso = matchMedia('(hover: hover) and (pointer: fine)');
const simulazioni = creaSimulazioni({dati, cambiato: aggiornaSimulazioni, riduciMovimento: () => riduciMovimento.matches});
// Modello: dati, indirizzo, navigazione e stato; nessuna geometria del disegno.
const board = createBoard({dati, riduciMovimento, aggiornaSimulazioni});
const boardState = board.state;
const selezioneBoard = board.selezioneBoard;
const modello = createModel({dati, getRenderer: () => rendererAttivo, getPanel: () => pannello, simulazioni, stretto, VISTA_3D, selezioneBoard, aggiornaSimulazioni});

// Pannello: contenuti letterali dei dati e soli testi dell'interfaccia ammessi.
const pannello = createPanel({dati, modello, simulazioni, dettaglioPin: board.dettaglioPin});

function aggiornaSimulazioni(stato = simulazioni.istantanea()) {
  rendererAttivo.aggiornaSimulazione?.({...stato, board: boardState});
  if (stato.id === 'sim_lut') $('announcement').textContent = `indirizzo ${stato.address} · O6 ${stato.o6}${stato.split ? ' · O5 ' + stato.o5 : ''}`;
  else if (stato.id === 'sim_distram' || stato.id === 'sim_srl') $('announcement').textContent = `indirizzo ${stato.address} · Q ${stato.output}`;
  else if (stato.id === 'sim_tristate') $('announcement').textContent = `Y ${stato.y} · Pin ${stato.wire}`;
  else if (stato.id === 'sim_bram') $('announcement').textContent = stato.collision === null ? `Porta A ${stato.outputs[0]} · Porta B ${stato.outputs[1]}` : 'collisione: valore non determinato';
  else if (stato.id === 'sim_switch') $('announcement').textContent = `switch matrix attraversate · ${new Set(stato.routes.flat()).size}`;
  else if (stato.id === 'sim_flow') $('announcement').textContent = dati.nodi.flusso.passi[stato.step].nome;
  else if (stato.id === 'sim_jtag') $('announcement').textContent = `TDO ${stato.tdo} · DONE ${Number(stato.done)}`;
}


// Renderer 2D: SVG, selezione grafica, trasformazioni e input del disegno.
// WCAG 2.5.3 (Label in Name): il nome accessibile di un controllo grafico contiene il testo che si vede.
function nomeConTesto(g, base) {
  const visibile = [...g.querySelectorAll('text')].filter(t => !t.closest('[aria-hidden="true"]')).map(t => t.textContent.trim()).filter(Boolean).join(' ');
  g.setAttribute('aria-label', visibile && !base.toLowerCase().includes(visibile.toLowerCase()) ? `${base} (${visibile})` : base);
}

const renderer2d = {
  gruppo:null, larghezza:1000, altezza:760, vista:{scala:1,x:0,y:0}, scalaMinima:.1, scalaIniziale:1, rapportoPrecedente:0, rapportoTesto:0, inTransizione:false, fotogramma:0, invitoMostrato:false,
  render(id) {
    const misure={board:[1000,900],chip:[1000,1000],regione:[1200,700],clb:[1000,700],slice:[1200,900],lut:[1200,800]};
    [this.larghezza,this.altezza]=misure[id] || [1200,760];
    this.vista={scala:1,x:0,y:0};
    $('drawing').replaceChildren();
    $('drawing').setAttribute('viewBox',`0 0 ${this.larghezza} ${this.altezza}`);
    $('drawing').setAttribute('aria-label',dati.nodi[id].titolo);
    $('drawing').classList.toggle('slice-diagram',id==='slice');$('drawing').classList.toggle('tracing',false);
    $('slice-paths')?.remove();
    this.retiSlice=null;this.reteSelezionata=null;this.scalaIniziale=1;this.rapportoPrecedente=0;this.rapportoTesto=0;
    this.gruppo=svg('g',{'data-renderer':'2d'},$('drawing'));
    this.parti=new Map();
    if (misure[id]) this[id](); else this.laterale(id);
    const livello=dati.livelli.find(l=>l.radice===id);
    this.parte(id,g=>{
      const titolo=livello?livello.nome:dati.nodi[id].titolo;
      const posizioni={board:[300,120],slice:[990,430],clb:[500,655]};
      const [x,y]=posizioni[id]||[this.larghezza/2,livello?32:40];
      if(livello){this.rettangolo(g,x-100,y-24,200,44,'var(--superficie)','var(--testo-2)');this.testo(g,titolo,x,y,18);this.bersaglio(g,x-100,y-24,200,44);}
    });
    const ordine=[...(dati.nodi[id].figli || []),id];
    ordine.forEach(n=>{const g=this.parti.get(n);if(g)this.gruppo.append(g);});
    this.ridimensiona(); this.applicaVista();this.aggiornaSimulazione({...simulazioni.istantanea(), board: boardState});
    if(id==='board' && !this.invitoMostrato){this.invitoMostrato=true;if(!riduciMovimento.matches)this.parti.get('board.fpga')?.classList.add('invitation');}
  },
  parte(id, disegna, classe='') {
    let gruppo=this.parti.get(id);
    if(!gruppo){gruppo=svg('g',{'data-node':id,role:'button',tabindex:'0','aria-label':dati.nodi[id].titolo,'aria-pressed':'false',class:'part '+classe},this.gruppo);this.parti.set(id,gruppo);}
    const visuale=svg('g',{class:'visual'},gruppo);
    disegna(visuale); nomeConTesto(gruppo,dati.nodi[id].titolo); return visuale;
  },
  rettangolo(g,x,y,w,h,riempimento='var(--superficie)',bordo='var(--testo-2)',classe='surface') {
    return svg('rect',{x,y,width:w,height:h,rx:6,fill:riempimento,stroke:bordo,class:classe},g);
  },
  risorsa(g,x,y,w,h,token) {const contorno=this.rettangolo(g,x,y,w,h,`var(--${token})`,'var(--inchiostro)','');contorno.setAttribute('stroke-width',3);return this.rettangolo(g,x,y,w,h,`var(--${token})`,this.scuro(token));},
  scuro(token){const c=getComputedStyle(document.documentElement).getPropertyValue('--'+token).trim();if(!/^#[a-f\d]{6}$/i.test(c))return 'var(--testo-2)';return '#'+[1,3,5].map(i=>Math.round(parseInt(c.slice(i,i+2),16)*.75).toString(16).padStart(2,'0')).join('');},
  testo(g,testo,x,y,dimensione=18,classe='',ancora='middle') {
    const sfondi=[...g.children].filter(e=>e.tagName.toLowerCase()==='rect'&&e.getAttribute('fill')!=='none'&&e.getAttribute('fill')!=='transparent').reverse();
    const sotto=sfondi.find(e=>x>=Number(e.getAttribute('x'))&&x<=Number(e.getAttribute('x'))+Number(e.getAttribute('width'))&&y>=Number(e.getAttribute('y'))&&y<=Number(e.getAttribute('y'))+Number(e.getAttribute('height')));
    if(sotto&&/^var\(--(?:slicel|slicem|dsp|memoria|cmt|io|metallo)\)$/.test(sotto.getAttribute('fill')))classe+=' ink';
    const t=svg('text',{x,y,'font-size':dimensione,'data-font':dimensione,'text-anchor':ancora,'dominant-baseline':'middle',class:classe},g);t.textContent=testo;return t;
  },
  filo(g,x1,y1,x2,y2,classe='') {return svg('path',{d:`M${x1} ${y1} L${x2} ${y2}`,class:'wire '+classe},g);},
  percorso(g,d,classe=''){return svg('path',{d,class:'wire '+classe},g);},
  freccia(g,x1,y1,x2,y2,doppia=false,classe='') {
    this.filo(g,x1,y1,x2,y2,classe);
    const angolo=Math.atan2(y2-y1,x2-x1), punta=(x,y,a)=>this.percorso(g,`M${x-9*Math.cos(a-.45)} ${y-9*Math.sin(a-.45)} L${x} ${y} L${x-9*Math.cos(a+.45)} ${y-9*Math.sin(a+.45)}`,classe);
    punta(x2,y2,angolo);if(doppia)punta(x1,y1,angolo+Math.PI);
  },
  bersaglio(g,x,y,w,h,bordo=false){return svg('rect',{x,y,width:w,height:h,fill:'transparent',class:bordo?'border-hit':'hit','data-hit-width':w,'data-hit-height':h,'data-hit-x':x,'data-hit-y':y},g);},
  etichettaEsterna(g,etichetta,x,y,tx,ty){this.filo(g,x,y,tx,ty);this.testo(g,etichetta,tx,ty-16,16);},
  board() {
    const g=this.gruppo;
    const pcb=this.rettangolo(g,20,20,960,860,'var(--scheda)','var(--scheda)','');pcb.setAttribute('rx',18);
    [[44,44],[956,44],[44,856],[956,856]].forEach(([cx,cy])=>{svg('circle',{cx,cy,r:10,fill:'var(--metallo)',stroke:'var(--chip)','stroke-width':3},g);svg('circle',{cx,cy,r:5,fill:'var(--sfondo)'},g);});
    for(let i=0;i<8;i++){const y=270+i*12;svg('path',{d:`M80 ${y} H${220+i*15} V${y+40} H430`,fill:'none',stroke:'var(--pista)','stroke-width':1,opacity:.35},g);}
    this.parte('board.fpga',p=>{this.rettangolo(p,430,250,140,140,'var(--chip)','var(--metallo)');for(let i=0;i<12;i++){const v=260+i*10;svg('path',{d:`M${v+180} 243 V250 M${v+180} 390 V397 M423 ${v} H430 M570 ${v} H577`,stroke:'var(--metallo)','stroke-width':3},p);}svg('circle',{cx:445,cy:265,r:4,fill:'var(--metallo)'},p);this.testo(p,'ARTIX-7',500,320,22,'light technical');});
    this.parte('board.clock',p=>{this.rettangolo(p,600,260,40,24,'var(--metallo)','var(--chip)');this.etichettaEsterna(p,'100 MHz',620,284,665,305);this.bersaglio(p,598,250,44,44);},'on-board');
    this.parte('board.flash',p=>{this.rettangolo(p,600,330,50,30,'var(--chip)','var(--metallo)');this.etichettaEsterna(p,'Quad-SPI',625,360,680,385);this.bersaglio(p,597,323,56,44);},'on-board');
    this.parte('board.ddr2',p=>{this.rettangolo(p,430,410,140,50,'var(--chip)','var(--metallo)');this.testo(p,'DDR2',500,435,20,'light technical');});
    this.parte('board.prog',p=>{this.rettangolo(p,30,150,50,36,'var(--metallo)','var(--chip)');this.testo(p,'PROG',125,167,16);this.rettangolo(p,690,180,26,26,'var(--chip)','var(--metallo)');this.testo(p,'PROG',703,222,16);svg('circle',{cx:657,cy:157,r:7,fill:'var(--inattivo)',stroke:'var(--chip)',class:'surface','data-config-done':''},p);this.testo(p,'DONE',657,137,16);this.bersaglio(p,30,146,50,44);this.bersaglio(p,681,171,44,44);this.bersaglio(p,635,135,44,44);},'on-board');
    this.parte('board.jp1',p=>{for(let i=0;i<3;i++)this.rettangolo(p,560+i*15,130,10,18,'var(--metallo)','var(--chip)');this.rettangolo(p,558,128,28,22,'var(--chip)','var(--metallo)');this.testo(p,'JP1',580,112,16);this.bersaglio(p,555,117,50,44);},'on-board');
    this.parte('board.usb_sd',p=>{this.rettangolo(p,160,30,70,40,'var(--metallo)','var(--chip)');this.testo(p,'USB',195,50,16,'ink');this.testo(p,'microSD',195,91,16);},'on-board');
    this.parte('board.pmod',p=>{[[950,220],[950,360],[20,300],[20,440]].forEach(([x,y])=>{this.rettangolo(p,x,y,30,100,'var(--chip)','var(--metallo)');for(let i=0;i<6;i++)for(let j=0;j<2;j++)svg('circle',{cx:x+9+j*12,cy:y+12+i*15,r:2,fill:'var(--metallo)'},p);this.bersaglio(p,x-7,y,44,100);});this.testo(p,'Pmod',916,347,16);},'on-board');
    this.parte('board.altri',p=>{['VGA','Ethernet','audio'].forEach((t,i)=>{this.rettangolo(p,300+i*120,30,110,50,'var(--metallo)','var(--chip)');this.testo(p,t,355+i*120,55,16,'ink');});});
    this.parte('board.switch',p=>{Object.entries(dati.nodi['board.switch'].pin).forEach(([nome,pin],i)=>{const x=75+i*54,g=svg('g',{'data-board-pin':pin},p);this.rettangolo(g,x,730,36,56,'var(--metallo)','var(--chip)');this.rettangolo(g,x+10,741,16,22,'var(--chip)','var(--chip)');this.testo(g,nome,x+18,808,14);this.testo(g,'('+pin+')',x+18,832,12,'pin-label technical');this.bersaglio(g,x-4,730,44,56);});},'on-board');
    this.parte('board.led',p=>{Object.entries(dati.nodi['board.led'].pin).forEach(([nome,pin],i)=>{const x=93+i*54,g=svg('g',{'data-board-pin':pin},p);svg('circle',{cx:x,cy:660,r:7,fill:'var(--memoria)',stroke:'var(--chip)',class:'surface'},g);this.testo(g,'LD'+i,x,688,12);this.testo(g,'('+pin+')',x,630,12,'pin-label technical');this.bersaglio(g,x-22,638,44,44);});},'on-board');
    this.parte('board.rgb',p=>{[750,815].forEach((x,i)=>{svg('circle',{cx:x,cy:520,r:10,fill:'var(--io)',stroke:'var(--chip)',class:'surface'},p);this.testo(p,'LD'+(16+i),x,551,14);this.bersaglio(p,x-22,498,44,44);});},'on-board');
    this.parte('board.display',p=>{this.rettangolo(p,160,520,420,80,'var(--chip)','var(--metallo)');for(let i=0;i<8;i++){const x=172+i*51,g=svg('g',{'data-board-digit':i},p);[[5,8,25,5],[30,14,5,23],[30,42,5,23],[5,65,25,5],[0,42,5,23],[0,14,5,23],[5,36,25,5]].forEach(([dx,dy,w,h])=>this.rettangolo(g,x+dx,520+dy,w,h,'var(--inattivo)','none',''));svg('circle',{cx:x+42,cy:588,r:3,fill:'var(--inattivo)'},g);}});
    this.parte('board.button',p=>{[[840,420,'BTNC'],[840,375,'BTNU'],[795,420,'BTNL'],[885,420,'BTNR'],[840,465,'BTND']].forEach(([x,y,n])=>{const lato=n==='BTNC'?44:30;this.rettangolo(p,x-lato/2,y-lato/2,lato,lato,'var(--metallo)','var(--chip)');this.bersaglio(p,x-22,y-22,44,44);this.testo(p,n,x+(n==='BTNL'?-60:0),y+(n==='BTNU'?-35:n==='BTND'?35:n==='BTNR'?30:0),12,n==='BTNC'?'ink':'');});this.rettangolo(p,700,230,30,30,'var(--errore)','var(--metallo)');this.testo(p,'CPU RESET',770,245,14);this.bersaglio(p,693,223,44,44);},'on-board');
  },
  chip() {
    const g=this.gruppo;this.rettangolo(g,60,60,880,880,'var(--superficie)','var(--testo-2)','');this.rettangolo(g,100,100,800,800,'var(--sfondo)','var(--testo-2)','');
    this.parte('chip.pin',p=>{for(let i=0;i<32;i++){const v=80+i*27;[[v,64],[v,936],[64,v],[936,v]].forEach(([cx,cy])=>svg('circle',{cx,cy,r:4,fill:'var(--z)',stroke:'var(--testo-2)',class:'surface'},p));}this.testo(p,'Pin',500,974,16);[[60,60,880,12],[60,928,880,12],[60,60,12,880],[928,60,12,880]].forEach(([x,y,w,h])=>this.bersaglio(p,x,y,w,h));});
    this.parte('chip.iobank',p=>{[100,860].forEach(x=>{for(let i=0;i<3;i++){this.risorsa(p,x,100+i*266.67,40,266.67,'io');const tx=x===100?82:918,ty=233+i*266.67;const t=this.testo(p,'banco',tx,ty,15,'external');t.setAttribute('transform',`rotate(-90 ${tx} ${ty})`);}});});
    const colonne=['I/O','CMT','L','M','L','L','BRAM','DSP','L','M','L','L',null,'L','M','L','L','BRAM','DSP','L','M','L','BRAM','CMT','I/O','GT'];
    this.parte('chip.colonne',p=>{colonne.forEach((nome,i)=>{if(!nome || nome==='GT')return;const x=113+i*30;const token=nome==='L'?'slicel':nome==='M'?'slicem':nome==='BRAM'?'memoria':nome==='DSP'?'dsp':nome==='CMT'?'cmt':'io';this.risorsa(p,x,154,24,680,token);for(let j=0;j<10;j++)this.filo(p,x,168+j*65,x+24,168+j*65);const t=this.testo(p,nome,x+12,400,16);if(nome.length>1)t.setAttribute('transform',`rotate(-90 ${x+12} 400)`);});});
    this.parte('chip.regioni',p=>{for(let r=0;r<3;r++)for(let c=0;c<2;c++){const x=100+c*400,y=100+r*800/3;const z=this.rettangolo(p,x,y,400,800/3,'none','var(--testo-2)','surface dashed');z.setAttribute('pointer-events','stroke');this.bersaglio(p,x,y,400,800/3,true);this.filo(p,x,y+400/3,x+400,y+400/3,'clock');}this.filo(p,500,100,500,900,'clock');svg('path',{d:'M485 440 L485 476 L518 458 Z',fill:'var(--clock)',stroke:'var(--inchiostro)',class:'surface'},p);this.rettangolo(p,526,438,70,34,'var(--superficie)','var(--bordo)','caption-bg');this.testo(p,'BUFG',561,455,18);this.rettangolo(p,515,523,70,34,'var(--superficie)','var(--bordo)','caption-bg');this.testo(p,'HROW',550,540,16);});
    this.parte('chip.config',p=>{this.rettangolo(p,450,850,100,40,'var(--superficie)','var(--testo-2)');this.testo(p,'JTAG',500,870,18);this.bersaglio(p,450,848,100,44);});
    this.parte('chip.xadc',p=>{this.risorsa(p,510,700,60,40,'io');this.testo(p,'XADC',540,720,15);this.bersaglio(p,510,698,60,44);});
    this.parte('chip.pcie',p=>{this.risorsa(p,625,600,60,40,'memoria');this.testo(p,'PCIe',655,620,15);this.bersaglio(p,625,598,60,44);});
    this.parte('chip.gtp',p=>{this.risorsa(p,113+25*30,154,24,680,'gt').classList.add('dashed');this.testo(p,'GT',910,865,16,'external');this.percorso(p,'M887 820 H910 V846');this.etichettaEsterna(p,'non collegata nel package CSG324',875,834,620,925);});
  },
  regione() {
    const g=this.gruppo;this.rettangolo(g,20,75,1160,570,'var(--superficie)','var(--bordo)','');
    this.parte('regione.io',p=>{for(let i=0;i<10;i++)this.risorsa(p,50,90+i*50,40,40,'io');this.testo(p,'… 50',70,625,18);});
    this.parte('regione.cmt',p=>{this.risorsa(p,135,265,60,160,'cmt');this.testo(p,'MMCM',165,310,15);this.testo(p,'PLL',165,380,15);});
    const colon=['L','M','L','BRAM','DSP','L','M','L'];
    colon.forEach((c,i)=>{const x=260+i*115;if(c==='L'||c==='M')this.parte('regione.clb',p=>{for(let j=0;j<10;j++)this.risorsa(p,x,95+j*50,40,40,c==='M'?'slicem':'slicel');this.testo(p,'… 50 CLB',x+20,70,16);this.testo(p,c,x+20,625,18);});else if(c==='BRAM')this.parte('regione.bram',p=>{for(let j=0;j<5;j++)this.risorsa(p,x,90+j*105,40,100,'memoria');this.testo(p,'10 per colonna',x+20,650,16);this.testo(p,'BRAM',x+20,70,16);});else this.parte('regione.dsp',p=>{for(let j=0;j<10;j++){this.risorsa(p,x,90+j*50,40,45,'dsp');this.filo(p,x,112.5+j*50,x+40,112.5+j*50);}this.testo(p,'20 slice DSP per colonna',x+80,680,16);this.testo(p,'DSP',x+20,70,16);});});
    this.parte('regione.hrow',p=>{this.freccia(p,25,350,1170,350,false,'clock');for(let i=0;i<8;i++)this.filo(p,280+i*115,337,280+i*115,365,'clock');this.testo(p,'HROW',1110,35,18);this.percorso(p,'M1110 52 V350 H1080','dashed');this.testo(p,'dalle linee globali (BUFG)',225,35,16);this.percorso(p,'M225 52 H20 V350','clock');this.bersaglio(p,22,344,1150,12);});
  },
  clb() {
    const g=this.gruppo;
    const vicino=(x,y,nx,ny)=>{const p=svg('g',{opacity:.35},g),ampio=nx===0,w=ampio?380:185,a=ampio?40:20,b=ampio?200:100,sw=ampio?140:65;this.rettangolo(p,x,y,w,150,'none','var(--testo-2)','dashed');this.risorsa(p,x+a,y+82,sw,50,'slicel');this.risorsa(p,x+b,y+20,sw,50,'slicem');this.testo(p,`SLICE_X${nx}Y${ny}`,x+a+sw/2+(ampio?55:0),y+145,12);this.testo(p,`SLICE_X${nx+1}Y${ny}`,x+b+sw/2+(ampio?55:0),y+85,12);this.rettangolo(p,x-40,y+40,30,85,'var(--sfondo)','var(--testo-2)','');this.freccia(p,x-10,y+70,x+a,y+105,true);this.freccia(p,x-10,y+60,x+b,y+45,true);};
    vicino(780,410,2,0);vicino(380,12,0,1);vicino(780,12,2,1);
    this.rettangolo(g,380,180,380,380,'none','var(--testo-2)','dashed');
    this.parte('clb.switch',p=>{this.rettangolo(p,200,240,120,260,'var(--superficie)','var(--testo-2)');this.testo(p,'switch',260,344,18);this.testo(p,'matrix',260,372,18);for(let i=0;i<4;i++)this.filo(p,210+i*24,420,210+i*24,480);this.freccia(p,320,455,420,455,true);this.percorso(p,'M320 280 H360 V280 H580');this.freccia(p,360,280,580,280,true);});
    this.parte('clb.slice0',p=>{this.risorsa(p,420,400,140,120,'slicem');this.testo(p,dati.nodi['clb.slice0'].titolo,490,460,20);});
    this.parte('clb.slice1',p=>{this.risorsa(p,580,220,140,120,'slicel');this.testo(p,dati.nodi['clb.slice1'].titolo,650,280,20);});
    this.parte('clb.carry',p=>{[[490,400,520],[650,220,340]].forEach(([x,haut,bas])=>{this.freccia(p,x,bas+70,x,bas,false,'clock');this.freccia(p,x,haut,x,x===490?144:82,false,'clock');this.testo(p,'CIN',x+40,bas+86,16);this.testo(p,'COUT',x+45,haut-45,16);this.bersaglio(p,x-16,haut-70,32,70);this.bersaglio(p,x-16,bas,32,70);});});
    this.parte('clb.nomi',p=>{this.testo(p,'SLICE_X0Y0',550,545,18,'technical');this.testo(p,'SLICE_X1Y0',710,365,18,'technical');this.bersaglio(p,410,530,160,30);this.bersaglio(p,570,350,160,30);});
  },
  slice() {
    const g=this.gruppo;
    // Nuovo modello grafico: solo le sei connessioni LUT/F7/F8 verificate.
    // Fonte: AMD UG474, Look-Up Table e Multiplexer Primitives. Nessun bit simulato.
    this.retiSlice=[
      {id:'d-f7b',da:'LUT D',a:'F7BMUX',porta:'O6',punti:[[280,115],[310,115],[310,210],[340,210]]},
      {id:'c-f7b',da:'LUT C',a:'F7BMUX',porta:'O6',punti:[[280,315],[322,315],[322,250],[340,250]]},
      {id:'b-f7a',da:'LUT B',a:'F7AMUX',porta:'O6',punti:[[280,515],[310,515],[310,610],[340,610]]},
      {id:'a-f7a',da:'LUT A',a:'F7AMUX',porta:'O6',punti:[[280,715],[322,715],[322,650],[340,650]]},
      {id:'f7b-f8',da:'F7BMUX',a:'F8MUX',punti:[[385,230],[410,230],[410,410],[450,410]]},
      {id:'f7a-f8',da:'F7AMUX',a:'F8MUX',punti:[[385,630],[428,630],[428,450],[450,450]]}
    ];
    const fili=svg('g',{class:'slice-nets','aria-hidden':'true'},g);
    this.retiSlice.forEach(rete=>{
      const d=rete.punti.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' ');
      this.percorso(fili,d,'net-halo');
      const linea=this.percorso(fili,d,'net');
      linea.setAttribute('data-net',rete.id);linea.setAttribute('data-from',rete.da);linea.setAttribute('data-to',rete.a);
      [rete.punti[0],rete.punti[rete.punti.length-1]].forEach(([cx,cy])=>svg('circle',{cx,cy,r:3,class:'net-port','data-net':rete.id},fili));
    });
    this.parte('slice.lut',p=>{
      ['D','C','B','A'].forEach((c,i)=>{
        const y=80+i*200,s=svg('g',{'data-symbol':'LUT '+c},p);
        this.risorsa(s,120,y,160,130,modello.stato.variante==='SLICEM'?'slicem':'slicel');
        this.testo(s,'LUT '+c,200,y+65,22);
        for(let j=0;j<6;j++){this.filo(s,100,y+9+j*22,120,y+9+j*22);this.testo(s,'A'+(j+1),90,y+9+j*22,12,'technical','end');}
        this.filo(s,280,y+95,298,y+95);
        this.testo(s,'O6',268,y+35,12,'technical','end');this.testo(s,'O5',268,y+95,12,'technical','end');
        if(modello.stato.variante==='SLICEM'){
          this.filo(s,140,y+130,140,y+145);this.filo(s,240,y+130,240,y+145);
          this.testo(s,'DI',140,y+165,14,'technical');this.testo(s,'WE',240,y+165,14,'technical');
        }
      });
      if(modello.stato.variante==='SLICEM'){this.testo(p,'RAM distribuita',430,55,16);this.testo(p,'Shift register',430,84,16);}
    });
    this.parte('slice.mux',p=>{
      [[340,230,'F7BMUX'],[340,630,'F7AMUX'],[450,430,'F8MUX']].forEach(([x,y,n])=>{
        const s=svg('g',{'data-symbol':n},p);
        svg('path',{d:`M${x} ${y-35} L${x+45} ${y-20} V${y+20} L${x} ${y+35} Z`,fill:'var(--slicel)',stroke:this.scuro('slicel'),class:'surface'},s);
        this.testo(s,n,x+18,y+65,14,'technical');this.bersaglio(s,x,y-35,45,70);
      });
      this.filo(p,495,430,530,430);this.testo(p,'O',530,407,12,'technical');
    });
    this.parte('slice.carry',p=>{
      this.rettangolo(p,560,80,80,730,'var(--sfondo)','var(--testo-2)','carry-frame');
      for(let i=0;i<4;i++){
        const y=110+i*200;
        const stage=svg('g',{'data-carry-stage':3-i},p);
        this.risorsa(stage,566,y,68,48,'cmt');this.testo(stage,'MUXCY',600,y+24,13,'technical');
        svg('circle',{cx:600,cy:y+78,r:20,fill:'var(--superficie)',stroke:'var(--testo-2)',class:'surface'},stage);
        this.testo(stage,'XOR',600,y+78,12,'technical');
        if(i<3)this.percorso(p,`M600 ${y+200} H650 V${y+48} H600`,'carry-wire');
      }
      this.percorso(p,'M600 850 H650 V758 H600','carry-wire');
      this.freccia(p,600,110,600,45,false,'carry-wire');
      this.testo(p,'CIN',600,830,16,'technical');this.testo(p,'COUT',650,50,16,'technical');
    });
    this.parte('slice.ff',p=>{
      for(let i=0;i<4;i++){
        const y=120+i*200;
        this.risorsa(p,720,y,70,50,'slicel');
        const fixed=svg('g',{class:'ff-fixed'},p);this.risorsa(fixed,820,y,70,50,'slicel');
        const t=this.testo(p,'',755,y+13,12,'technical ff-wrap');
        svg('tspan',{x:755,dy:0},t).textContent='FF/';svg('tspan',{x:755,dy:'1.12em'},t).textContent='Latch';
        this.testo(fixed,'FF',855,y+25,16,'technical');
        const note=this.testo(p,'non utilizzabile',1010,y+25,16.5,'ff-unavailable');note.style.visibility='hidden';
        this.filo(p,700,y+25,720,y+25);this.filo(p,790,y+25,800,y+25);
        this.filo(p,810,y+25,820,y+25);this.filo(p,890,y+25,940,y+25);
        this.testo(p,'D',706,y-14,12,'technical');this.testo(p,'Q',925,y+4,12,'technical');
      }
    });
    this.parte('slice.ctrl',p=>{
      // Il bus rappresenta i controlli condivisi; non è una netlist dei singoli pin.
      this.percorso(p,'M1060 860 H690 V195','clock control-bundle');
      this.testo(p,'CLK · CE · SR',950,835,18,'technical');
      for(let i=0;i<4;i++){
        const y=195+i*200;
        this.percorso(p,`M690 ${y} H855 V${y-25} M755 ${y} V${y-25}`,'clock control-bundle');
        [690,755].forEach(cx=>svg('circle',{cx,cy:y,r:3,class:'control-junction'},p));
      }
      // Tagli diagonali convenzionali distinguono il bus da un singolo filo.
      [705,713,721].forEach(x=>this.filo(p,x,854,x+8,866,'bus-tick'));
      this.bersaglio(p,700,848,360,24);
    });
    const nav=crea('nav',null,'slice-paths',$('stage'));nav.id='slice-paths';nav.setAttribute('aria-label','Collegati');
    this.retiSlice.forEach(rete=>{
      const nome=rete.da+(rete.porta?' · '+rete.porta:'')+' → '+rete.a;
      const b=pulsante(nome,()=>{modello.seleziona('slice.mux');this.evidenziaRete(rete.id);},nav);
      b.setAttribute('data-route',rete.id);b.setAttribute('aria-pressed','false');
    });
    nav.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.reteSelezionata){e.preventDefault();e.stopPropagation();this.evidenziaRete(null);}});
  },
  evidenziaRete(id) {
    const rete=this.retiSlice?.find(r=>r.id===id);
    this.reteSelezionata=rete?.id||null;
    $('drawing').classList.toggle('tracing',!!rete);
    this.gruppo.querySelectorAll('[data-net]').forEach(e=>e.classList.toggle('active',e.getAttribute('data-net')===rete?.id));
    this.gruppo.querySelectorAll('[data-symbol]').forEach(e=>e.classList.toggle('route-related',!!rete&&[rete.da,rete.a].includes(e.getAttribute('data-symbol'))));
    $('slice-paths')?.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute('data-route')===rete?.id)));
    if(rete){$('announcement').textContent=rete.da+(rete.porta?' · '+rete.porta:'')+' → '+rete.a;this.focalizza('slice.mux',rete.punti);}
  },
  focalizza(id,punti) {
    if(!this.gruppo)return;
    const rett=$('drawing').getBoundingClientRect(),rapporto=Math.min(rett.width/this.larghezza,rett.height/this.altezza)*this.vista.scala;
    if(!rapporto)return;
    const centri={board:[500,380],chip:[500,500],regione:[600,350],clb:[580,350],slice:[260,145],lut:[600,400]};
    let centro=punti?[(punti[0][0]+punti[punti.length-1][0])/2,(punti[0][1]+punti[punti.length-1][1])/2]:centri[id];
    if(!centro){const parte=this.parti.get(id),b=parte?.getBBox();if(b){const prima=parte.querySelector('.surface')?.getBBox();centro=b.height*rapporto>rett.height&&prima?[prima.x+prima.width/2,prima.y+prima.height/2]:[b.x+b.width/2,b.y+b.height/2];}}
    if(centro){
      const metaW=Math.min(this.larghezza/2,rett.width/rapporto/2),metaH=Math.min(this.altezza/2,rett.height/rapporto/2);
      centro=[Math.max(metaW,Math.min(this.larghezza-metaW,centro[0])),Math.max(metaH,Math.min(this.altezza-metaH,centro[1]))];
      this.vista.x=(this.larghezza/2-centro[0])*this.vista.scala;this.vista.y=(this.altezza/2-centro[1])*this.vista.scala;
    }
    this.richiediVista();
  },
  lut() {
    const g=this.gruppo;
    this.parte('lut.o5o6',p=>{[80,420].forEach(y=>{this.rettangolo(p,250,y,300,250,'none',this.scuro(modello.stato.modo==='lut.distram'?'memoria':'slicel'));this.testo(p,'LUT',400,y+35,20);this.bersaglio(p,250,y,300,250,true);});});
    this.parte('lut.sram',p=>{[80,420].forEach(y=>{for(let r=0;r<4;r++)for(let c=0;c<8;c++){const a=(y===80?32:0)+r*8+c;const cell=this.rettangolo(p,280+c*30,y+80+r*30,30,30,'var(--superficie)','var(--testo-2)');cell.setAttribute('data-sram-address',a);this.testo(p,'',295+c*30,y+95+r*30,12,'sram-value').setAttribute('data-sram-label',a);}});});
    for(let i=0;i<5;i++){const y=135+i*35;this.testo(g,'I'+i,85,y,18,'technical');this.percorso(g,`M115 ${y} H${150+i*15} V${y+340} H250 M${150+i*15} ${y} H250`);}
    this.parte('lut.mux',p=>{svg('path',{d:'M650 260 L730 290 V470 L650 500 Z',fill:'var(--slicel)',stroke:this.scuro('slicel'),class:'surface'},p);this.percorso(p,'M550 205 H610 V310 H650').setAttribute('data-lut-path','upper');this.percorso(p,'M550 545 H610 V450 H650').setAttribute('data-lut-path','lower');this.filo(p,690,120,690,275);this.testo(p,'I5',690,95,18,'technical');this.freccia(p,730,380,940,380);this.testo(p,'O6',980,380,22,'technical');});
    this.percorso(g,'M550 545 H850 V600 H940');this.testo(g,'O5',980,600,22,'technical');
    if(modello.stato.modo==='lut.distram'){this.testo(g,'DI',830,120,20);this.testo(g,'WE',830,175,20);this.testo(g,'CLK',830,230,20);this.percorso(g,'M800 120 H550 M800 175 H570 V545 H550 M800 230 H590 V565 H550');}
    if(modello.stato.modo==='lut.srl'){this.testo(g,'D',850,180,22);this.testo(g,'CLK',850,230,22);this.percorso(g,'M820 180 H570 V205 H550 M820 230 H595 V545 H550');}
    [['lut','Logica'],['lut.rom','ROM'],['lut.distram','RAM distribuita'],['lut.srl','Shift register']].forEach(([id,nome],i)=>{const x=80+i*280;this.parte(id,p=>{this.rettangolo(p,x,710,250,60,modello.stato.modo===id?'var(--slicem)':'var(--superficie)','var(--testo-2)');this.testo(p,nome,x+125,735,17,modello.stato.modo===id?'ink':'');if(i>1)this.testo(p,'solo SLICEM',x+125,758,12,modello.stato.modo===id?'ink':'');});});
  },
  laterale(id) {
    const g=this.gruppo;
    if(id==='bram'){
      this.parte(id,p=>{
        this.risorsa(p,330,145,360,440,'memoria');this.testo(p,'BRAM',510,110,28);
        for(let i=0;i<16;i++){
          this.rettangolo(p,345,160+i*25,330,23,'var(--superficie)','var(--testo-2)').setAttribute('data-bram-address',i);
          this.testo(p,i,310,172+i*25,14,'technical');this.testo(p,'00000000',510,172+i*25,17,'technical').setAttribute('data-bram-word',i);
        }
        ['A','B'].forEach((name,i)=>{const x=i?840:180;this.testo(p,'Porta '+name,x,310,20);this.testo(p,'0',x,405,24,'technical').setAttribute('data-bram-output',i);});
        this.freccia(p,240,360,330,360,true);this.freccia(p,690,360,780,360,true);
        this.testo(p,'memoria ridotta a 16 parole per la visualizzazione',600,650,17);
      });
    }else if(id==='dsp'){
      const parole=['pre-sommatore da 25 bit','moltiplicatore 25 × 18','sommatore e un accumulatore a 48 bit','rilevatore di configurazioni'];
      this.parte(id,p=>{parole.forEach((parola,i)=>{const x=55+i*280,y=300;this.risorsa(p,x,y,240,140,'dsp');const testo=dati.nodi.dsp.spiegazione[0];const inizio=testo.indexOf(parola);const esatto=inizio<0?'DSP':testo.slice(inizio,inizio+parola.length);this.testoMultiriga(p,esatto,x+120,y+55,21,18);if(i<3)this.freccia(p,x+240,y+70,x+280,y+70);const hit=this.bersaglio(p,x,y,240,140);hit.addEventListener('click',()=>{$('announcement').textContent=esatto;});});this.freccia(p,175,570,175,440);this.freccia(p,1015,300,1015,170);});
    }else if(id==='iob'){
      this.parte(id,p=>{
        this.testo(p,'A',100,250,22);this.testo(p,'B',100,315,22);this.filo(p,125,250,220,250);this.filo(p,125,315,220,315);
        this.risorsa(p,220,220,160,125,'io');this.testo(p,'AND',300,282,24);this.filo(p,380,282,500,282);
        svg('path',{d:'M500 220 L500 345 L610 282 Z',fill:'var(--io)',stroke:'var(--testo-2)',class:'surface'},p);
        this.filo(p,550,170,550,248);this.testo(p,'EN',550,145,20);
        this.percorso(p,'M610 282 H900','tristate-output').setAttribute('data-tristate-line','');this.testo(p,'Y',950,250,22);
        this.testo(p,'Z',950,300,26,'technical').setAttribute('data-tristate-y','');
        this.testo(p,'Pin bidirezionale',600,425,22);
        this.risorsa(p,220,500,180,100,'io');this.testo(p,'FPGA',310,525,20);this.testo(p,'Z',310,565,24,'technical').setAttribute('data-tristate-fpga','');
        this.risorsa(p,800,500,210,100,'io');this.testo(p,'dispositivo esterno',905,525,18);this.testo(p,'Z',905,565,24,'technical').setAttribute('data-tristate-external','');
        this.percorso(p,'M400 550 H800','tristate-pin-wire').setAttribute('data-tristate-pin-line','');
        this.testo(p,'Z',600,520,26,'technical').setAttribute('data-tristate-wire','');
      });
    }else if(id==='cmt'){
      this.parte(id,p=>{this.risorsa(p,120,210,260,320,'cmt');this.testo(p,'CMT',250,245,24);this.rettangolo(p,160,285,180,70,'var(--superficie)','var(--inchiostro)');this.testo(p,'MMCM',250,320,22);this.rettangolo(p,160,405,180,70,'var(--superficie)','var(--inchiostro)');this.testo(p,'PLL',250,440,22);this.filo(p,380,370,500,370,'clock');svg('path',{d:'M500 335 L500 405 L560 370 Z',fill:'var(--cmt)',stroke:'var(--testo-2)',class:'surface'},p);this.testo(p,'BUFG',530,440,20);this.filo(p,560,370,1050,370,'clock');this.testo(p,'HROW',840,340,22);[690,850,1010].forEach(x=>{this.filo(p,x,240,x,540,'clock');[250,500].forEach(y=>{this.risorsa(p,x-30,y,60,45,'slicel');this.testo(p,'FF',x,y+22,16);});});});
    }else if(id==='interconnessione'){
      this.parte(id,p=>{
        p.parentElement.setAttribute('role','group');
        for(let r=0;r<4;r++)for(let c=0;c<4;c++){
          const i=r*4+c,x=180+c*220,y=170+r*120,cell=svg('g',{'data-switch-cell':i,'data-node':id,role:'button',tabindex:0,'aria-label':'CLB '+i},p);
          this.risorsa(cell,x,y,120,70,'slicel');this.testo(cell,'CLB '+i,x+60,y+35,19);this.bersaglio(cell,x,y,120,70);nomeConTesto(cell,'CLB '+i);
          this.rettangolo(p,x-35,y+70,30,30,'var(--gt)','var(--testo-2)').setAttribute('data-switch-matrix',i);
          this.testo(p,'',x-20,y+85,12,'technical').setAttribute('data-switch-mux',i);
          this.filo(p,x-20,y+85,x,y+35);if(c<3)this.filo(p,x-20,y+85,x+200,y+85);if(r<3)this.filo(p,x-20,y+85,x-20,y+205);
        }
        svg('g',{'data-routing-overlay':'','pointer-events':'none'},p);
        this.testo(p,'schema: le linee reali sono segmentate e di lunghezze diverse',600,705,17);
      });
    }else if(id==='configurazione'){
      this.parte(id,p=>{
        this.rettangolo(p,300,180,500,380,'var(--chip)','var(--testo-2)');this.testo(p,'ARTIX-7',550,365,28,'light');
        const celle=[[330,210],[480,210],[630,210],[750,270],[750,490],[600,530],[450,530],[330,480]];
        celle.forEach(([x,y],i)=>{
          this.risorsa(p,x-18,y-18,36,36,'slicel').setAttribute('data-jtag-cell',i);this.testo(p,'',x,y,18,'technical ink').setAttribute('data-jtag-bit',i);
          if(i)this.filo(p,celle[i-1][0],celle[i-1][1],x,y,'jtag-chain');
          const dx=(550-x)*.28,dy=(365-y)*.28;this.filo(p,x,y,x+dx,y+dy,'jtag-normal');
        });
        this.freccia(p,120,210,312,210);this.testo(p,'TDI',105,180,20);this.freccia(p,312,480,120,480);this.testo(p,'TDO',100,510,20);
        this.testo(p,'TCK',550,620,20);this.filo(p,550,600,550,560);this.testo(p,'DONE',920,365,20);
        svg('circle',{cx:920,cy:405,r:12,fill:'var(--inattivo)',stroke:'var(--testo-2)','data-config-done':''},p);
        this.rettangolo(p,350,670,400,24,'var(--sfondo)','var(--testo-2)');this.rettangolo(p,350,670,0,24,'var(--attivo)','none','').setAttribute('data-config-progress','');
      });
    }else if(id==='flusso'){
      this.parte(id,p=>{p.parentElement.setAttribute('role','group');dati.nodi.flusso.passi.forEach((passo,i)=>{const x=i%4*285+30,y=i<4?190:450,card=svg('g',{'data-flow-step':i,'data-node':id,role:'button',tabindex:0,'aria-label':passo.nome},p);this.risorsa(card,x,y,255,140,i===6?'memoria':i<3?'cmt':'slicel');this.testoMultiriga(card,passo.nome,x+127,y+58,21,19);this.bersaglio(card,x,y,255,140);nomeConTesto(card,passo.nome);if(i!==3&&i!==6)this.freccia(p,x+255,y+70,x+285,y+70);if(i===3)this.percorso(p,`M${x+127} ${y+140} V410 H157 V450`);});});
    }
  },
  testoMultiriga(g,testo,x,y,limite,dimensione){const parole=testo.split(' '),righe=[''];parole.forEach(p=>{if((righe[righe.length-1]+' '+p).trim().length>limite&&righe[righe.length-1])righe.push(p);else righe[righe.length-1]=(righe[righe.length-1]+' '+p).trim();});righe.forEach((r,i)=>this.testo(g,r,x,y+i*(dimensione+8),dimensione));},
  aggiornaSimulazione(s) {
    if(!this.gruppo)return;
    const memory=['sim_lut','sim_distram','sim_srl'].includes(s.id);
    this.gruppo.querySelectorAll('[data-sram-address]').forEach(e=>{
      const a=Number(e.getAttribute('data-sram-address')),v=memory?s.cells[a]:undefined;
      e.setAttribute('fill',v===undefined?'var(--superficie)':v?'var(--attivo)':'var(--inattivo)');
      e.classList.toggle('sram-reading',memory&&(a===s.address||(s.split&&a===s.low)));
    });
    this.gruppo.querySelectorAll('[data-sram-label]').forEach(e=>{const v=memory?s.cells[Number(e.getAttribute('data-sram-label'))]:undefined;e.textContent=v===undefined?'':String(v);e.classList.toggle('ink',v===1);e.style.fill='var(--testo)';});
    this.gruppo.querySelectorAll('[data-lut-path]').forEach(e=>e.classList.toggle('sim-route',memory&&(e.getAttribute('data-lut-path')===(s.address>=32?'upper':'lower')||(s.split&&e.getAttribute('data-lut-path')==='lower'))));
    this.gruppo.querySelectorAll('.ff-fixed').forEach(e=>e.classList.toggle('ff-disabled',s.ffLatch));
    this.gruppo.querySelectorAll('.ff-unavailable').forEach(e=>e.style.visibility=s.ffLatch?'visible':'hidden');
    this.gruppo.querySelectorAll('[data-carry-stage]').forEach(e=>e.classList.toggle('sim-carry-current',s.id==='sim_carry'&&s.step>0&&Number(e.getAttribute('data-carry-stage'))===(s.step-1)%4));
    const wide=s.id==='sim_widemux'&&!s.small;
    if(wide&&this.reteSelezionata)this.evidenziaRete(null);
    const selected=wide?[s.inputs[6]?'b-f7a':'a-f7a',s.inputs[6]?'d-f7b':'c-f7b',s.inputs[7]?'f7b-f8':'f7a-f8']:[];
    this.gruppo.querySelectorAll('[data-net]').forEach(e=>e.classList.toggle('sim-route',selected.includes(e.getAttribute('data-net'))));
    this.gruppo.querySelectorAll('[data-board-pin]').forEach(e=>e.classList.toggle('board-pin-selected',s.board?.pin===e.getAttribute('data-board-pin')));
    this.gruppo.querySelectorAll('[data-board-digit]').forEach(e=>e.classList.toggle('display-active',s.board?.digit===Number(e.getAttribute('data-board-digit'))));
    const bram=s.id==='sim_bram',config=s.id==='sim_jtag'?s:s.configuration;
    this.gruppo.querySelectorAll('[data-bram-word]').forEach(e=>{const a=Number(e.dataset.bramWord),v=bram?s.cells[a]:0;e.textContent=v==='?'?'?':v.toString(2).padStart(8,'0');e.classList.toggle('bram-word-read',bram&&s.ports.some(p=>p.address===a));});
    this.gruppo.querySelectorAll('[data-bram-address]').forEach(e=>{const a=Number(e.dataset.bramAddress);e.classList.toggle('bram-read',bram&&s.ports.some(p=>p.address===a));e.classList.toggle('bram-collision',bram&&s.cells[a]==='?');});
    this.gruppo.querySelectorAll('[data-bram-output]').forEach(e=>e.textContent=bram?s.outputs[Number(e.dataset.bramOutput)]:0);
    const tri=s.id==='sim_tristate';
    for(const key of ['y','wire','fpga','external'])this.gruppo.querySelectorAll('[data-tristate-'+key+']').forEach(e=>{const v=tri?s[key]:'Z';e.textContent=v;e.classList.toggle('signal-conflict',v==='X');});
    for(const [key,value] of [['line',tri?s.y:'Z'],['pin-line',tri?s.wire:'Z']])this.gruppo.querySelectorAll('[data-tristate-'+key+']').forEach(e=>{e.classList.toggle('signal-z',value==='Z');e.classList.toggle('signal-conflict',value==='X');});
    this.gruppo.querySelectorAll('[data-jtag-cell]').forEach(e=>{const v=config?.cells[Number(e.dataset.jtagCell)];e.setAttribute('fill',config?.test?(v?'var(--attivo)':'var(--inattivo)'):'var(--slicel)');});
    this.gruppo.querySelectorAll('[data-jtag-bit]').forEach(e=>e.textContent=config?.test?config.cells[Number(e.dataset.jtagBit)]:'');
    this.gruppo.querySelectorAll('.jtag-chain').forEach(e=>e.style.visibility=config?.test?'visible':'hidden');
    this.gruppo.querySelectorAll('.jtag-normal').forEach(e=>e.style.visibility=config?.test?'hidden':'visible');
    this.gruppo.querySelectorAll('[data-config-done]').forEach(e=>e.setAttribute('fill',config?.done?'var(--attivo)':'var(--inattivo)'));
    this.gruppo.querySelectorAll('[data-config-progress]').forEach(e=>e.setAttribute('width',4*(config?.progress||0)));
    this.gruppo.querySelectorAll('[data-flow-step]').forEach(e=>{const active=s.id==='sim_flow'&&s.step===Number(e.dataset.flowStep);e.classList.toggle('flow-current',active);e.setAttribute('aria-pressed',String(active));});
    const routes=s.id==='sim_switch'?s.routes:[],selectedMatrix=new Set(routes.flat());
    this.gruppo.querySelectorAll('[data-switch-matrix]').forEach(e=>e.classList.toggle('matrix-active',selectedMatrix.has(Number(e.dataset.switchMatrix))));
    this.gruppo.querySelectorAll('[data-switch-cell]').forEach(e=>e.setAttribute('aria-pressed',String(s.id==='sim_switch'&&s.source===Number(e.dataset.switchCell))));
    this.gruppo.querySelectorAll('[data-switch-mux]').forEach(e=>{const i=Number(e.dataset.switchMux),route=routes.find(r=>r.includes(i)),pos=route?.indexOf(i),prev=route?.[pos-1];e.textContent=route?pos===0?'▷':prev===i-1?'▶':prev===i+1?'◀':prev===i-4?'▼':'▲':'';});
    const overlay=this.gruppo.querySelector('[data-routing-overlay]'),signature=JSON.stringify(routes);
    if(overlay&&overlay.dataset.routes!==signature){
      overlay.dataset.routes=signature;overlay.replaceChildren();
      routes.forEach((route,i)=>{
        const point=n=>[160+n%4*220+i*3,255+Math.floor(n/4)*120+i*3],a=point(route[0]),b=point(route.at(-1));
        const points=[[a[0]+20,a[1]-50],...route.map(point),[b[0]+20,b[1]-50]];
        this.percorso(overlay,points.map(([x,y],j)=>(j?'L':'M')+x+' '+y).join(' '),'sim-chip-route route-'+i);
      });
    }
  },
  seleziona(id) {
    this.parti.forEach((g,n)=>{g.classList.toggle('selected',n===id);if(g.getAttribute('role')==='button')g.setAttribute('aria-pressed',String(n===id));else g.removeAttribute('aria-pressed');});
    if(this.retiSlice&&id!=='slice.mux')this.evidenziaRete(null);
    this.focalizza(id);
    $('drawing').querySelectorAll('.pin-label').forEach(t=>{t.style.visibility=(id==='board.switch'||id==='board.led')?'visible':'hidden';});
  },
  ridimensiona() {
    if(!this.gruppo)return;
    const rett=$('drawing').getBoundingClientRect();
    const base=Math.min(rett.width/this.larghezza,rett.height/this.altezza);
    if(!base)return;
    if(this.rapportoPrecedente!==base){
      const prima=this.scalaIniziale;this.scalaIniziale=Math.min(8,Math.max(1,.85/base));
      if(!this.rapportoPrecedente)this.vista.scala=this.scalaIniziale;
      else if(this.vista.scala>1)this.vista.scala=Math.min(8,Math.max(this.scalaMinima,this.vista.scala*this.scalaIniziale/prima));
      this.rapportoPrecedente=base;
      this.focalizza(modello.stato.selezione,this.retiSlice?.find(r=>r.id===this.reteSelezionata)?.punti);
    }
    const rapporto=base*this.vista.scala;
    if(this.rapportoTesto!==rapporto){
    this.rapportoTesto=rapporto;
    // In panoramica i testi si riducono insieme ai simboli, senza riempire di nuovo le corsie.
    const riferimento=Math.max(rapporto,base*this.scalaIniziale);
    this.gruppo.querySelectorAll('text[data-font]').forEach(t=>t.setAttribute('font-size',Math.max(Number(t.getAttribute('data-font')),14.01/riferimento)));
    this.gruppo.querySelectorAll('[data-hit-width]').forEach(r=>{
      const w=Number(r.getAttribute('data-hit-width')),h=Number(r.getAttribute('data-hit-height')),x=Number(r.getAttribute('data-hit-x')),y=Number(r.getAttribute('data-hit-y'));
      if(r.classList.contains('border-hit')){r.setAttribute('stroke-width',Math.max(12,44/rapporto));return;}
      const nw=Math.max(w,44/rapporto),nh=Math.max(h,44/rapporto);r.setAttribute('x',x+(w-nw)/2);r.setAttribute('y',y+(h-nh)/2);r.setAttribute('width',nw);r.setAttribute('height',nh);
    });
    }
    this.gruppo.setAttribute('transform',this.transformation());
  },
  transformation(v=this.vista){return `translate(${this.larghezza/2+v.x} ${this.altezza/2+v.y}) scale(${v.scala}) translate(${-this.larghezza/2} ${-this.altezza/2})`;},
  applicaVista(){
    if(this.vista.scala<this.scalaMinima){this.vista.scala=this.scalaMinima;this.focalizza(modello.stato.selezione,this.retiSlice?.find(r=>r.id===this.reteSelezionata)?.punti);}
    this.ridimensiona();
  },
  richiediVista(){if(this.fotogramma)return;this.fotogramma=requestAnimationFrame(()=>{this.fotogramma=0;this.applicaVista();});},
  punto(clientX,clientY){const p=$('drawing').createSVGPoint();p.x=clientX;p.y=clientY;return p.matrixTransform($('drawing').getScreenCTM().inverse());},
  zoom(fattore,cx,cy){if(this.inTransizione)return;const v=this.vista,nuova=Math.max(this.scalaMinima,Math.min(8,v.scala*fattore));const x=cx??this.larghezza/2,y=cy??this.altezza/2;const rapporto=nuova/v.scala;v.x=x-this.larghezza/2-(x-this.larghezza/2-v.x)*rapporto;v.y=y-this.altezza/2-(y-this.altezza/2-v.y)*rapporto;v.scala=nuova;if(nuova<=1){v.x=0;v.y=0;}this.richiediVista();},
  async transizione(id,inversa,disegna){
    if(this.inTransizione)return;
    if(riduciMovimento.matches){disegna();return;}
    this.inTransizione=true;
    const originale=this.gruppo,partenza={...this.vista},vecchiaLarghezza=this.larghezza,vecchiaAltezza=this.altezza;
    const selezionato=this.parti.get(id);
    const box=selezionato?.getBBox();
    const destinazione=inversa?{scala:.5,x:0,y:0}:box?{scala:Math.max(1,Math.min(this.larghezza/Math.max(box.width,1),this.altezza/Math.max(box.height,1))),x:0,y:0}:{scala:1.8,x:0,y:0};
    if(box&&!inversa){destinazione.x=(this.larghezza/2-box.x-box.width/2)*destinazione.scala;destinazione.y=(this.altezza/2-box.y-box.height/2)*destinazione.scala;}
    const inizio=performance.now();
    await new Promise(risolvi=>{const anima=tempo=>{const t=Math.min(1,(tempo-inizio)/450),e=t*t*(3-2*t);originale.setAttribute('transform',this.transformation({scala:partenza.scala+(destinazione.scala-partenza.scala)*e,x:partenza.x+(destinazione.x-partenza.x)*e,y:partenza.y+(destinazione.y-partenza.y)*e}));if(t<1)requestAnimationFrame(anima);else risolvi();};requestAnimationFrame(anima);});
    disegna();
    const precedente=svg('svg',{viewBox:`0 0 ${vecchiaLarghezza} ${vecchiaAltezza}`,width:this.larghezza,height:this.altezza,'aria-hidden':'true'},$('drawing'));
    precedente.style.pointerEvents='none';precedente.append(originale);
    const animazione=this.gruppo.animate([{opacity:0},{opacity:1}],{duration:200,easing:'ease-in-out'});
    precedente.animate([{opacity:1},{opacity:0}],{duration:200,easing:'ease-in-out',fill:'forwards'});
    try{await animazione.finished;}catch{}
    precedente.remove();this.inTransizione=false;
    if(modello.inAttesa){const attesa=modello.inAttesa;modello.inAttesa=null;modello.render(attesa.id,attesa.opzioni);}
  },
  input() {
    const s=$('drawing'),puntatori=new Map();let trascinamento=null,pizzico=null,tocco=null,sopprimiClick=false,timer=0;
    s.addEventListener('click',e=>{if(sopprimiClick||this.inTransizione)return;const route=e.target.closest('[data-switch-cell]'),flow=e.target.closest('[data-flow-step]');if(route){modello.selezionaSwitch(Number(route.dataset.switchCell));return;}if(flow){modello.selezionaPasso(Number(flow.dataset.flowStep));return;}const cell=e.target.closest('[data-sram-address]');if(cell&&simulazioni.istantanea().editable){e.preventDefault();simulazioni.cella(Number(cell.getAttribute('data-sram-address')));return;}const p=e.target.closest('[data-node]'),pin=e.target.closest('[data-board-pin]');if(p){modello.seleziona(p.dataset.node);if(pin)modello.selezionaPin(pin.getAttribute('data-board-pin'));}else if(this.retiSlice)this.evidenziaRete(null);});
    s.addEventListener('dblclick',e=>{const p=e.target.closest('[data-node]');if(p&&!sopprimiClick){e.preventDefault();modello.entra(p.dataset.node);}});
    s.addEventListener('keydown',e=>{const p=e.target.closest('[data-node]'),route=e.target.closest('[data-switch-cell]'),flow=e.target.closest('[data-flow-step]');if((e.key==='Enter'||e.key===' ')&&(route||flow)){e.preventDefault();route?modello.selezionaSwitch(Number(route.dataset.switchCell)):modello.selezionaPasso(Number(flow.dataset.flowStep));return;}if(e.key==='Escape'&&this.reteSelezionata){e.preventDefault();e.stopPropagation();this.evidenziaRete(null);return;}if((e.key==='Enter'||e.key===' ')&&p){e.preventDefault();e.shiftKey&&e.key==='Enter'?modello.entra(p.dataset.node):modello.seleziona(p.dataset.node);}});
    s.addEventListener('focusin',e=>{const p=e.target.closest('[data-node]');if(p)this.focalizza(p.dataset.node);});
    s.addEventListener('pointerdown',e=>{
      if(this.inTransizione||e.button>0)return;
      puntatori.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(puntatori.size===1)trascinamento={x:e.clientX,y:e.clientY,inizioX:e.clientX,inizioY:e.clientY,mosso:false};
      if(puntatori.size===2){const[a,b]=[...puntatori.values()];pizzico={distanza:Math.hypot(a.x-b.x,a.y-b.y)};if(trascinamento)trascinamento.mosso=true;sopprimiClick=true;}
    });
    s.addEventListener('pointermove',e=>{
      if(!puntatori.has(e.pointerId))return;
      puntatori.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pizzico&&puntatori.size===2){const[a,b]=[...puntatori.values()],d=Math.hypot(a.x-b.x,a.y-b.y),p=this.punto((a.x+b.x)/2,(a.y+b.y)/2);this.zoom(d/pizzico.distanza,p.x,p.y);pizzico.distanza=d;nascondiTooltip();return;}
      if(!trascinamento||pizzico)return;
      if(Math.hypot(e.clientX-trascinamento.inizioX,e.clientY-trascinamento.inizioY)>6){trascinamento.mosso=true;sopprimiClick=true;if(!s.hasPointerCapture(e.pointerId))s.setPointerCapture(e.pointerId);}
      if(trascinamento.mosso){const a=this.punto(trascinamento.x,trascinamento.y),b=this.punto(e.clientX,e.clientY);this.vista.x+=b.x-a.x;this.vista.y+=b.y-a.y;this.richiediVista();nascondiTooltip();}
      trascinamento.x=e.clientX;trascinamento.y=e.clientY;
    });
    const rilascia=e=>{
      if(!puntatori.has(e.pointerId))return;
      const mosso=trascinamento?.mosso||pizzico;
      puntatori.delete(e.pointerId);
      if(s.hasPointerCapture(e.pointerId))s.releasePointerCapture(e.pointerId);
      if(!mosso&&e.type!=='pointercancel'&&e.pointerType!=='mouse'){
        const p=e.target.closest('[data-node]'),ora=performance.now();
        if(p){if(tocco&&tocco.id===p.dataset.node&&ora-tocco.ora<350){modello.entra(p.dataset.node);tocco=null;}else tocco={id:p.dataset.node,ora};}
      }
      if(puntatori.size===0){trascinamento=null;pizzico=null;setTimeout(()=>{sopprimiClick=false;},0);}
    };
    s.addEventListener('pointerup',rilascia);s.addEventListener('pointercancel',rilascia);
    s.addEventListener('wheel',e=>{e.preventDefault();nascondiTooltip();const p=this.punto(e.clientX,e.clientY);this.zoom(Math.exp(-e.deltaY*.0015),p.x,p.y);},{passive:false});
    const nascondiTooltip=()=>{clearTimeout(timer);$('tooltip').hidden=true;};
    s.addEventListener('pointerover',e=>{
      nascondiTooltip();if(!preciso.matches||puntatori.size)return;
      const p=e.target.closest('[data-node]');if(!p)return;
      timer=setTimeout(()=>{const n=dati.nodi[p.dataset.node],t=$('tooltip');t.replaceChildren();crea('strong',n.titolo,null,t);crea('span',n.in_breve,null,t);t.hidden=false;const r=t.getBoundingClientRect();t.style.left=Math.min(innerWidth-r.width-12,Math.max(12,e.clientX+16))+'px';t.style.top=Math.min(innerHeight-r.height-12,Math.max(12,e.clientY+16))+'px';},300);
    });
    s.addEventListener('pointerout',nascondiTooltip);s.addEventListener('pointerdown',nascondiTooltip);
  }
};

// Renderer attivo: SVG nella pagina 2D, Three.js nella pagina 3D; modello e pannello sono condivisi.
let rendererAttivo;
if (VISTA_3D) {
  try {
    rendererAttivo = creaRenderer3d({dati, modello, mount:$('three-view'), navigazione:$('three-nodes')});
  } catch (errore) {
    console.error(errore);
    $('three-view').dataset.error = errore.message;
    const ripiego = crea('div', null, 'three-fallback', $('three-view'));
    pulsante('2D', () => cambiaVista('index.html'), ripiego);
    rendererAttivo = {gruppo:null, inTransizione:false, vista:{x:0,y:0}, render(){}, seleziona(){}, ridimensiona(){}, zoom(){}, applicaVista(){}, richiediVista(){}, input(){}, transizione(id, inversa, azione){azione();}};
  }
} else rendererAttivo = renderer2d;

function legenda() {
  const l=$('legend');l.replaceChildren();
  const testa=crea('div',null,'legend-head',l);crea('h2','Legenda',null,testa);
  pulsante('×',()=>apriLegenda(false),testa).setAttribute('aria-label','Legenda');
  const griglia=crea('div',null,'legend-grid',l);
  [['slicel','SLICEL'],['slicem','SLICEM'],['dsp','DSP'],['memoria','RAM distribuita'],['cmt','CMT'],['io','I/O'],['clock','HROW'],['gt','GTP']].forEach(([token,nome])=>{const r=crea('div',null,'legend-item',griglia);const c=crea('span',null,'swatch',r);c.style.background=`var(--${token})`;crea('span',nome,null,r);});
  const simboli=crea('div',null,'legend-grid legend-symbols',l);
  const esempi=[['BUFG','M4 4 L4 28 L30 16 Z'],['MUX','M5 3 L29 9 V23 L5 29 Z'],['FF','M4 3 H33 V29 H4 Z M4 12 L12 16 L4 20'],['Latch','M4 3 H33 V29 H4 Z'],['CLK','M2 25 V7 H12 V25 H22 V7 H34'],['Z','M3 16 H34']];
  esempi.forEach(([nome,d])=>{const r=crea('div',null,'legend-item',simboli);const ic=svg('svg',{viewBox:'0 0 40 32',class:'symbol','aria-hidden':'true'},r);const p=svg('path',{d},ic);if(nome==='Z')p.setAttribute('stroke-dasharray','4 3');if(nome==='Latch'){const t=svg('text',{x:13,y:20},ic);t.textContent='D';}crea('span',nome,null,r);});
}
function apriLegenda(apri){$('legend').hidden=!apri;$('legend-button').setAttribute('aria-expanded',String(apri));if(apri)$('legend').querySelector('button').focus();else $('legend-button').focus();}
function applicaTema(tema,salva=false){
  document.documentElement.dataset.theme=tema;
  const prossimo=tema==='dark'?'Tema chiaro':'Tema scuro';
  $('theme-button').textContent=tema==='dark'?'☀':'☾';$('theme-button').setAttribute('aria-label',prossimo);$('theme-button').title=prossimo;
  if(salva)try{localStorage.setItem('esploratore-fpga-tema',tema);}catch{}
  if(rendererAttivo.gruppo&&!rendererAttivo.inTransizione){rendererAttivo.render(modello.stato.radice);rendererAttivo.seleziona(modello.stato.selezione);}
  aggiornaSimulazioni();
}
function daIndirizzo(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{id='board';}modello.render(id||'board',{daIndirizzo:true,precedente:history.state?.precedente || ritornoVista});}
function impostaFoglio(percentuale){modello.stato.foglio=percentuale;modello.stato.pannelloAperto=true;modello.aperturaPannello();}
$('brand').textContent=dati.meta.titolo;$('brand').title=dati.meta.titolo;document.title=dati.meta.titolo;
$('schema-notice').textContent=dati.meta.avviso_schema;$('schema-notice').title=dati.meta.avviso_schema;
$('board-notice').textContent=dati.meta.avviso_board;
$('flow-button').addEventListener('click',()=>modello.render('flusso'));
$('back-button').addEventListener('click',()=>modello.esci());
$('panel-toggle').addEventListener('click',()=>{modello.stato.pannelloAperto=!modello.stato.pannelloAperto;modello.aperturaPannello();});
$('zoom-in').addEventListener('click',()=>rendererAttivo.zoom(1.25));$('zoom-out').addEventListener('click',()=>rendererAttivo.zoom(.8));
$('fit-button').addEventListener('click',()=>{rendererAttivo.vista={scala:1,x:0,y:0};rendererAttivo.applicaVista();});
$('legend-button').addEventListener('click',()=>apriLegenda($('legend').hidden));
$('theme-button').addEventListener('click',()=>applicaTema(document.documentElement.dataset.theme==='dark'?'light':'dark',true));

// Il passaggio fra i due file conserva il nodo e il contesto di esplorazione.
const parametriVista=new URLSearchParams(location.search);
const varianteVista=parametriVista.get('variante');
if(dati.nodi.slice.varianti.includes(varianteVista))modello.stato.variante=varianteVista;
const modoVista=parametriVista.get('modo');
if(['lut','lut.rom','lut.distram','lut.srl'].includes(modoVista))modello.stato.modo=modoVista;
const ritornoVista=parametriVista.get('ritorno');
if(dati.nodi[ritornoVista])modello.stato.precedente=ritornoVista;
function cambiaVista(file){
  const p=new URLSearchParams({variante:modello.stato.variante,modo:modello.stato.modo,ritorno:modello.stato.precedente,tema:document.documentElement.dataset.theme});
  location.href=file+'?'+p.toString()+'#'+encodeURIComponent(modello.stato.selezione);
}
$('view-3d')?.addEventListener('click',()=>cambiaVista('3d.html'));
$('view-2d')?.addEventListener('click',()=>cambiaVista('index.html'));

let tema=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
try{const salvato=localStorage.getItem('esploratore-fpga-tema');if(['dark','light'].includes(salvato))tema=salvato;}catch{}
if(['light','dark'].includes(parametriVista.get('tema')))tema=parametriVista.get('tema');
applicaTema(tema);legenda();rendererAttivo.input();
const maniglia=$('sheet-handle');let trascinaFoglio=null;
maniglia.addEventListener('pointerdown',e=>{if(e.button>0)return;trascinaFoglio={y:e.clientY,valore:modello.stato.foglio,mosso:false};maniglia.setPointerCapture(e.pointerId);});
maniglia.addEventListener('pointermove',e=>{if(!trascinaFoglio)return;const delta=(trascinaFoglio.y-e.clientY)/$('workspace').clientHeight*100;if(Math.abs(delta)>1)trascinaFoglio.mosso=true;const altezza=Math.max(20,Math.min(85,trascinaFoglio.valore+delta));$('workspace').style.setProperty('--sheet',altezza+'%');});
const terminaFoglio=e=>{if(!trascinaFoglio)return;const t=trascinaFoglio;trascinaFoglio=null;if(maniglia.hasPointerCapture(e.pointerId))maniglia.releasePointerCapture(e.pointerId);const valore=t.valore+(t.y-e.clientY)/$('workspace').clientHeight*100;impostaFoglio(t.mosso?[20,45,85].reduce((a,b)=>Math.abs(a-valore)<Math.abs(b-valore)?a:b):[20,45,85][([20,45,85].indexOf(modello.stato.foglio)+1)%3]);};
maniglia.addEventListener('pointerup',terminaFoglio);maniglia.addEventListener('pointercancel',()=>{trascinaFoglio=null;modello.aperturaPannello();});
maniglia.addEventListener('click',e=>{if(e.detail===0)impostaFoglio([20,45,85][([20,45,85].indexOf(modello.stato.foglio)+1)%3]);});
maniglia.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();impostaFoglio([20,45,85][([20,45,85].indexOf(modello.stato.foglio)+1)%3]);return;}if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const i=[20,45,85].indexOf(modello.stato.foglio);impostaFoglio(e.key==='Home'?20:e.key==='End'?85:[20,45,85][Math.max(0,Math.min(2,i+(e.key==='ArrowUp'?1:-1)))]);}});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();if(!$('legend').hidden)apriLegenda(false);else modello.esci();return;}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&$('stage').contains(e.target)){e.preventDefault();rendererAttivo.vista.x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;rendererAttivo.vista.y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;rendererAttivo.richiediVista();}
});
document.addEventListener('pointerdown',e=>{if(!$('legend').hidden&&!$('legend').contains(e.target)&&!$('legend-button').contains(e.target))apriLegenda(false);});
addEventListener('popstate',daIndirizzo);addEventListener('hashchange',()=>{let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{id='board';}if(id!==modello.stato.selezione)daIndirizzo();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){board.ferma();simulazioni.ferma();}else if(modello.stato.selezione==='board.display')selezioneBoard('board.display');});
riduciMovimento.addEventListener('change',()=>{simulazioni.ferma();selezioneBoard(modello.stato.selezione);});
stretto.addEventListener('change',()=>modello.aperturaPannello());
new ResizeObserver(()=>rendererAttivo.ridimensiona()).observe(VISTA_3D?$('three-view'):$('drawing'));
daIndirizzo();
if(!location.hash||!dati.nodi[location.hash.slice(1)])history.replaceState({nodo:modello.stato.selezione,precedente:modello.stato.precedente},'','#'+modello.stato.selezione);
