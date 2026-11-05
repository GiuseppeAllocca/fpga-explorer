import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function creaRenderer3d({ dati, modello, mount, navigazione }) {
  const scena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, .05, 1000);
  const webgl = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  webgl.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  webgl.outputColorSpace = THREE.SRGBColorSpace;
  webgl.toneMapping = THREE.ACESFilmicToneMapping;
  webgl.toneMappingExposure = 1;
  webgl.domElement.id = 'three-canvas';
  webgl.domElement.tabIndex = 0;
  webgl.domElement.setAttribute('aria-label', '3D');
  webgl.domElement.dataset.renderer = 'three-webgl2';
  webgl.domElement.dataset.threeRevision = THREE.REVISION;
  mount.append(webgl.domElement);
  const etichette = document.createElement('div');
  etichette.className = 'three-labels';
  etichette.setAttribute('aria-hidden', 'true');
  mount.append(etichette);
  const controlli = new OrbitControls(camera, webgl.domElement);
  controlli.enableDamping = false;
  controlli.minPolarAngle = .12;
  controlli.maxPolarAngle = Math.PI * .48;
  controlli.screenSpacePanning = true;
  controlli.addEventListener('change', richiediDisegno);
  const luce = new THREE.HemisphereLight(0xffffff, 0x596178, 1.3);
  scena.add(luce);
  const sole = new THREE.DirectionalLight(0xffffff, 1.8);
  sole.position.set(-12, 24, 15);
  scena.add(sole);
  const riempimento = new THREE.DirectionalLight(0xc7dcff, .6);
  riempimento.position.set(20, 9, -12);
  scena.add(riempimento);

  const geometriaBox = new THREE.BoxGeometry(1, 1, 1);
  const geometriaCilindro = new THREE.CylinderGeometry(1, 1, 1, 20);
  const materiali = new Map();
  let gruppo, parti, bersagli, testi, decorazioni, selezione, bordoSelezione;
  let larghezza = 1000, altezza = 760, distanzaAdatta = 35, richiesto = 0, fotogrammi = 0;
  let radice = 'board', animazione = 0, versioneScena = 0;
  let dimensioniPrecedenti = [0, 0];
  const ridotto = matchMedia('(prefers-reduced-motion: reduce)');
  const raycaster = new THREE.Raycaster();
  const cursore = new THREE.Vector2();
  const stile = token => getComputedStyle(document.documentElement).getPropertyValue('--' + token).trim();
  const colore = token => token.startsWith('#') ? token : stile(token);
  const posizione = (x, z, y = 0) => new THREE.Vector3((x-larghezza/2)/50, y/50, (z-altezza/2)/50);
  const materiale = (token, opacita = 1) => {
    const c = colore(token), chiave = c + '/' + opacita;
    if (!materiali.has(chiave)) materiali.set(chiave, new THREE.MeshStandardMaterial({ color:c, roughness:.58, metalness:token==='metallo'?.65:.08, transparent:opacita<1, opacity:opacita }));
    return materiali.get(chiave);
  };
  function parte(id) {
    if (!id) return gruppo;
    if (!parti.has(id)) { const p=new THREE.Group(); p.userData.nodeId=id; gruppo.add(p); parti.set(id,p); }
    return parti.get(id);
  }
  function box(id,x,z,w,h,spessore,token,quota=0,opacita=1) {
    const m=new THREE.Mesh(geometriaBox, materiale(token,opacita));
    m.scale.set(w/50,spessore/50,h/50);
    m.position.copy(posizione(x+w/2,z+h/2,quota+spessore/2));
    m.userData.nodeId=id; parte(id).add(m); if(id)bersagli.push(m); return m;
  }
  function cilindro(id,x,z,r,spessore,token,quota=0,opacita=1) {
    const m=new THREE.Mesh(geometriaCilindro,materiale(token,opacita));
    m.scale.set(r/50,spessore/50,r/50);m.position.copy(posizione(x,z,quota+spessore/2));m.userData.nodeId=id;
    parte(id).add(m);if(id)bersagli.push(m);return m;
  }
  function filo(id,punti,token='testo-2',raggio=1.5,opacita=1) {
    for(let i=1;i<punti.length;i++) {
      const a=posizione(...punti[i-1]),b=posizione(...punti[i]);
      const direzione=b.clone().sub(a), lunghezza=direzione.length(); if(lunghezza<.0001)continue;
      const m=new THREE.Mesh(geometriaCilindro,materiale(token,opacita));
      m.scale.set(raggio/50,lunghezza,raggio/50);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direzione.normalize());
      m.userData.nodeId=id;parte(id).add(m);if(id)bersagli.push(m);
    }
  }
  function cornice(id,x,z,w,h,quota=10,token='testo-2',opacita=1) {
    filo(id,[[x,z,quota],[x+w,z,quota],[x+w,z+h,quota],[x,z+h,quota],[x,z,quota]],token,1.4,opacita);
  }
  function trapezio(id,x,z,w,h,spessore,token,quota=0) {
    const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(w/50,h*.2/50);s.lineTo(w/50,h*.8/50);s.lineTo(0,h/50);s.closePath();
    const geo=new THREE.ExtrudeGeometry(s,{depth:spessore/50,bevelEnabled:false});decorazioni.push(geo);
    const m=new THREE.Mesh(geo,materiale(token));m.rotation.x=Math.PI/2;m.position.copy(posizione(x,z,quota+spessore));m.userData.nodeId=id;parte(id).add(m);bersagli.push(m);return m;
  }
  function etichetta(id,testo,x,z,quota=25,importante=false) {
    const e=document.createElement('span');e.className='three-label';e.textContent=testo;e.dataset.nodeLabel=id;e.dataset.important=String(importante);etichette.append(e);
    testi.push({elemento:e,posizione:posizione(x,z,quota),id,importante});
  }
  function pedana(w=larghezza-40,h=altezza-80) { box(radice,20,65,w,h,10,'superficie',-12); }
  function ingressoLut(id,x,z,w,h,lettera,token='slicel',quota=0) {
    box(id,x,z,w,h,25,token,quota);etichetta(id,'LUT '+lettera,x+w/2,z+h/2,quota+31,true);
    for(let j=0;j<6;j++)filo(id,[[x-22,z+12+j*(h-24)/5,quota+9],[x,z+12+j*(h-24)/5,quota+9]],'metallo',1.2);
    filo(id,[[x+w,z+h*.27,quota+9],[x+w+30,z+h*.27,quota+9]],'testo-2',1.5);
    filo(id,[[x+w,z+h*.75,quota+9],[x+w+30,z+h*.75,quota+9]],'testo-2',1.5);
  }

  function liberaScena() {
    if(gruppo)scena.remove(gruppo);
    for(const g of decorazioni || [])g.dispose();
    for(const m of materiali.values())m.dispose();materiali.clear();
    if(bordoSelezione)scena.remove(bordoSelezione);bordoSelezione?.geometry.dispose();bordoSelezione?.material.dispose();bordoSelezione=null;
    gruppo=new THREE.Group();scena.add(gruppo);parti=new Map();bersagli=[];testi=[];decorazioni=[];etichette.replaceChildren();
  }
  function disegnaEtichette() {
    const w=mount.clientWidth,h=mount.clientHeight;
    const occupati=[];
    const ordine=[...testi].sort((a,b)=>(b.id===selezione)-(a.id===selezione)||Number(b.importante)-Number(a.importante));
    for(const t of ordine) {
      const p=t.posizione.clone().project(camera),e=t.elemento;
      const x=(p.x+1)*w/2,y=(1-p.y)*h/2;
      const largo=t.largo||(t.largo=e.offsetWidth),alto=t.alto||(t.alto=e.offsetHeight);
      const r={x:x-largo/2,y:y-alto/2,w:largo,h:alto};
      const dentro=p.z<1&&p.z>-1&&x>8&&x<w-8&&y>8&&y<h-8;
      const sovrapposta=occupati.some(a=>r.x<a.x+a.w+4&&r.x+r.w+4>a.x&&r.y<a.y+a.h+3&&r.y+r.h+3>a.y);
      const visibile=dentro&&!sovrapposta;
      e.hidden=!visibile;
      e.classList.toggle('selected',t.id===selezione);
      if(visibile){e.style.left=x+'px';e.style.top=y+'px';occupati.push(r);}
    }
  }
  function disegna() {
    richiesto=0;if(!gruppo||mount.clientWidth<1||mount.clientHeight<1)return;
    webgl.render(scena,camera);disegnaEtichette();fotogrammi++;
    Object.assign(webgl.domElement.dataset,{frames:String(fotogrammi),triangles:String(webgl.info.render.triangles),drawCalls:String(webgl.info.render.calls)});
  }
  function richiediDisegno(){if(!richiesto)richiesto=requestAnimationFrame(disegna);}
  function adatta() {
    const boxScena=new THREE.Box3().setFromObject(gruppo),dimensione=boxScena.getSize(new THREE.Vector3());
    boxScena.getCenter(controlli.target);
    const direzione=new THREE.Vector3(.45,1.2,1.02).normalize();
    let minimo=dimensione.length()/2+.1,massimo=minimo*10;
    for(let passo=0;passo<22;passo++){
      const distanza=(minimo+massimo)/2;
      camera.position.copy(direzione).multiplyScalar(distanza).add(controlli.target);camera.lookAt(controlli.target);camera.updateMatrixWorld(true);
      let mx=0,my=0;
      for(const x of [boxScena.min.x,boxScena.max.x])for(const y of [boxScena.min.y,boxScena.max.y])for(const z of [boxScena.min.z,boxScena.max.z]){
        const p=new THREE.Vector3(x,y,z).project(camera);mx=Math.max(mx,Math.abs(p.x));my=Math.max(my,Math.abs(p.y));
      }
      if(mx<=.88&&my<=.86)massimo=distanza;else minimo=distanza;
    }
    distanzaAdatta=massimo*1.015;camera.position.copy(direzione).multiplyScalar(distanzaAdatta).add(controlli.target);
    camera.near=.05;camera.far=Math.max(200,distanzaAdatta*8);camera.updateProjectionMatrix();
    controlli.minDistance=distanzaAdatta/4;controlli.maxDistance=distanzaAdatta*2;controlli.update();richiediDisegno();
  }

  const renderer = {
    get gruppo(){return gruppo;},inTransizione:false,vista:{scala:1,x:0,y:0},
    render(id) {
      versioneScena++;cancelAnimationFrame(animazione);radice=id;
      [larghezza,altezza]=({board:[1000,760],chip:[1000,1000],regione:[1200,700],clb:[1000,700],slice:[1200,900],lut:[1200,800]})[id]||[1200,760];
      liberaScena();scena.background=new THREE.Color(stile('sfondo'));
      if(costruisci[id])costruisci[id]();else laterale(id);
      for(const nodo of [...(dati.nodi[id].figli||[]),id])if(!parti.has(nodo))throw Error('Nodo senza mesh: '+nodo);
      navigazione.replaceChildren();
      for(const nodo of [...(dati.nodi[id].figli||[]),id]){
        const b=document.createElement('button');b.type='button';b.dataset.node=nodo;b.textContent=dati.nodi[nodo].titolo;b.setAttribute('aria-label',dati.nodi[nodo].titolo);b.setAttribute('aria-pressed','false');
        b.addEventListener('click',()=>modello.seleziona(nodo));b.addEventListener('dblclick',()=>modello.entra(nodo));
        b.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.shiftKey){e.preventDefault();modello.entra(nodo);}});navigazione.append(b);
      }
      webgl.domElement.dataset.root=id;webgl.domElement.dataset.sceneNodes=JSON.stringify([...parti.keys()]);
      let conteggio=0;gruppo.traverse(o=>{if(o.isMesh)conteggio++;});webgl.domElement.dataset.meshCount=String(conteggio);
      this.ridimensiona();adatta();disegna();
    },
    seleziona(id) {
      selezione=id;
      if(bordoSelezione){scena.remove(bordoSelezione);bordoSelezione.geometry.dispose();bordoSelezione.material.dispose();bordoSelezione=null;}
      const p=parti.get(id);
      if(p){bordoSelezione=new THREE.BoxHelper(p,new THREE.Color(stile('accento')));bordoSelezione.material.depthTest=false;bordoSelezione.renderOrder=10;scena.add(bordoSelezione);}
      for(const b of navigazione.children)b.setAttribute('aria-pressed',String(b.dataset.node===id));
      richiediDisegno();
    },
    ridimensiona(){const w=mount.clientWidth,h=mount.clientHeight;if(w<1||h<1)return;if(w!==dimensioniPrecedenti[0]||h!==dimensioniPrecedenti[1]){webgl.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dimensioniPrecedenti=[w,h];if(gruppo)adatta();}richiediDisegno();},
    zoom(fattore){const distanza=camera.position.distanceTo(controlli.target),nuova=THREE.MathUtils.clamp(distanza/fattore,controlli.minDistance,controlli.maxDistance);camera.position.sub(controlli.target).multiplyScalar(nuova/distanza).add(controlli.target);controlli.update();richiediDisegno();},
    applicaVista(){adatta();this.vista={scala:1,x:0,y:0};},
    richiediVista(){const delta=new THREE.Vector3(this.vista.x/100,0,this.vista.y/100);camera.position.add(delta);controlli.target.add(delta);this.vista.x=0;this.vista.y=0;controlli.update();richiediDisegno();},
    transizione(id,inversa,prossima) {
      if(ridotto.matches){prossima();return;}
      this.inTransizione=true;controlli.enabled=false;const token=versioneScena;const obiettivo=controlli.target.clone();
      const p=parti.get(id);if(p&&!inversa)new THREE.Box3().setFromObject(p).getCenter(obiettivo);
      const a=controlli.target.clone(),aCamera=camera.position.clone();
      const finale=inversa?camera.position.clone().multiplyScalar(1.2):camera.position.clone().sub(obiettivo).multiplyScalar(.7).add(obiettivo);
      const inizio=performance.now();
      const passo=t=>{if(token!==versioneScena)return;const v=Math.min(1,(t-inizio)/450),e=v*v*(3-2*v);controlli.target.lerpVectors(a,obiettivo,e);camera.position.lerpVectors(aCamera,finale,e);camera.lookAt(controlli.target);disegna();if(v<1)animazione=requestAnimationFrame(passo);else{prossima();mount.animate([{opacity:.2},{opacity:1}],{duration:200});this.inTransizione=false;controlli.enabled=true;if(modello.inAttesa){const attesa=modello.inAttesa;modello.inAttesa=null;modello.render(attesa.id,attesa.opzioni);}}};
      animazione=requestAnimationFrame(passo);
    },
    input() {
      let inizio=null,ultimoTocco=null,timer;
      const trova=e=>{const r=webgl.domElement.getBoundingClientRect();cursore.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(cursore,camera);return raycaster.intersectObjects(bersagli,false)[0]?.object.userData.nodeId;};
      webgl.domElement.addEventListener('pointerdown',e=>{inizio={x:e.clientX,y:e.clientY,id:e.pointerId};document.getElementById('tooltip').hidden=true;});
      webgl.domElement.addEventListener('pointerup',e=>{if(!inizio||inizio.id!==e.pointerId)return;const mosso=Math.hypot(e.clientX-inizio.x,e.clientY-inizio.y)>7;inizio=null;if(mosso||this.inTransizione)return;const id=trova(e);if(!id)return;modello.seleziona(id);if(e.pointerType!=='mouse'){const ora=performance.now();if(ultimoTocco?.id===id&&ora-ultimoTocco.ora<350){modello.entra(id);ultimoTocco=null;}else ultimoTocco={id,ora};}});
      webgl.domElement.addEventListener('pointercancel',()=>{inizio=null;});
      webgl.domElement.addEventListener('dblclick',e=>{const id=trova(e);if(id)modello.entra(id);});
      webgl.domElement.addEventListener('pointermove',e=>{
        clearTimeout(timer);const t=document.getElementById('tooltip');t.hidden=true;if(inizio||e.pointerType!=='mouse')return;
        const id=trova(e);webgl.domElement.style.cursor=id?'pointer':'grab';if(!id)return;
        timer=setTimeout(()=>{const n=dati.nodi[id];t.replaceChildren();const titolo=document.createElement('strong');titolo.textContent=n.titolo;const breve=document.createElement('span');breve.textContent=n.in_breve;t.append(titolo,breve);t.hidden=false;const r=t.getBoundingClientRect();t.style.left=Math.min(innerWidth-r.width-12,e.clientX+16)+'px';t.style.top=Math.min(innerHeight-r.height-12,e.clientY+16)+'px';},300);
      });
      webgl.domElement.addEventListener('pointerleave',()=>{clearTimeout(timer);document.getElementById('tooltip').hidden=true;});
      webgl.domElement.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(e.shiftKey)modello.entra();else modello.seleziona(modello.stato.selezione);}});
      webgl.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('view-2d').focus();});
    }
  };

  const costruisci = {};
  // Le scene usano quote illustrative; non rappresentano profondità fisiche del silicio.

  costruisci.board = () => {
    box('board',20,20,960,720,13,'scheda',-13);
    for(const [x,z] of [[44,44],[956,44],[44,716],[956,716]]){
      cilindro('board',x,z,12,2,'metallo');cilindro('board',x,z,6,3,'chip',1);
    }
    for(let i=0;i<8;i++)filo(null,[[80,270+i*12,1],[220+i*15,270+i*12,1],[220+i*15,310+i*12,1],[430,310+i*12,1]],'pista',.6);
    box('board.fpga',430,250,140,140,32,'chip',2);
    for(let i=0;i<12;i++){
      const x=440+i*10,z=260+i*10;
      box('board.fpga',x,242,4,10,6,'metallo',8);box('board.fpga',x,388,4,10,6,'metallo',8);
      box('board.fpga',422,z,10,4,6,'metallo',8);box('board.fpga',568,z,10,4,6,'metallo',8);
    }
    cilindro('board.fpga',445,265,3,1,'metallo',34);etichetta('board.fpga','ARTIX-7',500,320,42,true);
    box('board.clock',600,260,40,24,15,'metallo',2);etichetta('board.clock',dati.nodi['board.clock'].numeri[0].valore,645,260,35,true);
    box('board.flash',600,330,50,30,12,'chip',2);etichetta('board.flash','Quad-SPI',650,360,28);
    box('board.ddr2',430,410,140,50,17,'chip',2);etichetta('board.ddr2','DDR2',500,435,30,true);
    box('board.prog',30,150,50,36,32,'metallo',2);box('board.prog',32,155,32,26,34,'chip',3);
    box('board.prog',690,180,26,26,14,'chip',2);cilindro('board.prog',657,157,7,8,'memoria',2);
    etichetta('board.prog','PROG',80,155,45);etichetta('board.prog','DONE',657,145,28);
    for(let i=0;i<3;i++)box('board.jp1',562+i*15,131,6,14,22,'metallo',2);
    box('board.jp1',558,128,29,22,16,'chip',12);etichetta('board.jp1','JP1',580,112,40);
    box('board.usb_sd',160,30,70,40,34,'metallo',2);box('board.usb_sd',168,22,52,15,36,'chip',2);etichetta('board.usb_sd','USB · microSD',195,70,40);
    for(const [x,z] of [[950,220],[950,360],[20,300],[20,440]]){
      box('board.pmod',x,z,30,100,25,'chip',2);
      for(let r=0;r<6;r++)for(let c=0;c<2;c++)cilindro('board.pmod',x+8+c*14,z+12+r*15,2,1,'metallo',28);
    }
    etichetta('board.pmod','Pmod',948,330,38);
    for(const [i,t] of ['VGA','Ethernet','audio'].entries()){
      box('board.altri',300+i*120,30,110,50,35,'metallo',2);box('board.altri',308+i*120,25,94,16,29,'chip',6);etichetta('board.altri',t,355+i*120,55,45);
    }
    Object.keys(dati.nodi['board.switch'].pin).forEach((nome,i)=>{
      const x=140+i*45;box('board.switch',x,660,36,56,12,'metallo',2);box('board.switch',x+11,668,14,25,12,'chip',14);
    });etichetta('board.switch',dati.nodi['board.switch'].titolo,500,718,35,true);
    Object.keys(dati.nodi['board.led'].pin).forEach((nome,i)=>cilindro('board.led',158+i*45,625,7,8,'memoria',2));
    etichetta('board.led',dati.nodi['board.led'].titolo,500,607,26);
    for(const [i,x] of [760,800].entries()){
      cilindro('board.rgb',x,520,10,10,'io',2);etichetta('board.rgb','LD'+(16+i),x,548,24);
    }
    box('board.display',160,520,420,80,16,'chip',2);
    for(let i=0;i<8;i++){
      const x=172+i*51;
      for(const [dx,dz,w,h] of [[5,8,25,5],[30,14,5,23],[30,42,5,23],[5,65,25,5],[0,42,5,23],[0,14,5,23],[5,36,25,5]])box('board.display',x+dx,520+dz,w,h,2,'inattivo',18);
      cilindro('board.display',x+42,588,3,2,'inattivo',18);
    }
    etichetta('board.display',dati.nodi['board.display'].titolo,370,510,34);
    for(const [x,z,nome] of [[840,420,'BTNC'],[840,375,'BTNU'],[795,420,'BTNL'],[885,420,'BTNR'],[840,465,'BTND']]){
      box('board.button',x-16,z-16,32,32,12,'chip',2);cilindro('board.button',x,z,11,8,'metallo',14);
    }
    box('board.button',700,230,30,30,15,'errore',2);etichetta('board.button','CPU RESET',745,230,35);etichetta('board.button',dati.nodi['board.button'].titolo,840,478,30);
  };

  costruisci.chip = () => {
    box('chip',60,60,880,880,18,'chip',-18);box('chip',100,100,800,800,8,'superficie');
    for(let i=0;i<30;i++){
      const v=80+i*29;for(const [x,z] of [[v,68],[v,932],[68,v],[932,v]])cilindro('chip.pin',x,z,4,4,'metallo',1);
    }
    etichetta('chip.pin','Pin',500,955,20);
    for(const x of [100,860])for(let i=0;i<3;i++){
      box('chip.iobank',x,100+i*800/3,40,800/3-4,20,'io',8);etichetta('chip.iobank','banco',x===100?85:915,230+i*800/3,40);
    }
    const colonne=['I/O','CMT','L','M','L','L','BRAM','DSP','L','M','L','L',null,'L','M','L','L','BRAM','DSP','L','M','L','BRAM','CMT','I/O','GT'];
    for(const [i,nome] of colonne.entries()){
      if(!nome)continue;const x=150+i*27;
      const token=nome==='L'?'slicel':nome==='M'?'slicem':nome==='BRAM'?'memoria':nome==='DSP'?'dsp':nome==='CMT'?'cmt':nome==='GT'?'gt':'io';
      const id=nome==='GT'?'chip.gtp':'chip.colonne';
      for(let j=0;j<10;j++)box(id,x,154+j*68,21,64,nome==='BRAM'?22:14,token,8);
      if(['CMT','BRAM','DSP','GT'].includes(nome))etichetta(id,nome,x+10.5,490,52);
    }
    for(let r=0;r<3;r++)for(let c=0;c<2;c++){
      cornice('chip.regioni',100+c*400,100+r*800/3,400,800/3,34,'clock');
      filo('chip.regioni',[[100+c*400,100+r*800/3+400/3,36],[500+c*400,100+r*800/3+400/3,36]],'clock',2.3);
    }
    filo('chip.regioni',[[500,100,38],[500,900,38]],'clock',3.5);trapezio('chip.regioni',484,440,34,36,10,'cmt',36);etichetta('chip.regioni','BUFG · HROW',500,465,65,true);
    box('chip.config',450,850,100,40,22,'gt',8);etichetta('chip.config','JTAG',500,870,48);
    box('chip.xadc',510,700,60,40,25,'io',24);etichetta('chip.xadc','XADC',540,720,62);
    box('chip.pcie',625,600,60,40,25,'memoria',24);etichetta('chip.pcie','PCIe',655,620,62);
    etichetta('chip.gtp','non collegata nel package CSG324',800,910,55,true);
  };

  costruisci.regione = () => {
    pedana(1160,570);
    for(let i=0;i<10;i++)box('regione.io',50,90+i*50,40,40,28,'io');etichetta('regione.io','… 50',70,625,38);
    box('regione.cmt',135,265,60,160,32,'cmt');etichetta('regione.cmt','MMCM · PLL',165,340,50,true);
    for(const [i,c] of ['L','M','L','BRAM','DSP','L','M','L'].entries()){
      const x=260+i*115;
      if(c==='L'||c==='M'){
        for(let j=0;j<10;j++){
          box('regione.clb',x,95+j*50,40,40,14,c==='M'?'slicem':'slicel');
          box('regione.clb',x+4,100+j*50,12,27,5,'slicem',14);box('regione.clb',x+23,100+j*50,12,27,5,'slicel',14);
        }etichetta('regione.clb','… 50 CLB',x+20,70,45);
      }else if(c==='BRAM'){
        for(let j=0;j<5;j++)box('regione.bram',x,90+j*105,40,100,32,'memoria');etichetta('regione.bram','10 per colonna',x+20,650,40,true);
      }else{
        for(let j=0;j<10;j++){box('regione.dsp',x,90+j*50,40,20,24,'dsp');box('regione.dsp',x,115+j*50,40,20,24,'dsp');}
        etichetta('regione.dsp','20 slice DSP per colonna',x+20,680,38,true);
      }
    }
    filo('regione.hrow',[[20,350,38],[1170,350,38]],'clock',3.2);
    for(let i=0;i<8;i++)filo('regione.hrow',[[280+i*115,335,38],[280+i*115,365,38]],'clock',1.5);
    etichetta('regione.hrow','HROW',1040,325,58,true);etichetta('regione.hrow','dalle linee globali (BUFG)',200,40,40,true);
  };

  costruisci.clb = () => {
    box('clb',380,180,380,380,8,'superficie',-8);cornice('clb',380,180,380,380,2);
    const vicino=(x,z,nx,ny,ampio=false)=>{
      const w=ampio?380:185,a=ampio?40:20,b=ampio?200:100,sw=ampio?140:65;
      box(null,x,z,w,150,6,'slicel',-8,.2);cornice(null,x,z,w,150,1,'testo-2',.35);
      box(null,x+a,z+82,sw,50,20,'slicem',0,.35);box(null,x+b,z+20,sw,50,20,'slicel',0,.35);
      etichetta('clb.nomi',`SLICE_X${nx}Y${ny}`,x+a+sw/2,z+145,25);
      etichetta('clb.nomi',`SLICE_X${nx+1}Y${ny}`,x+b+sw/2,z+85,25);
      box(null,x-40,z+40,30,85,12,'gt',0,.35);filo(null,[[x-10,z+65,8],[x+b,z+45,8]],'testo-2',1,.4);filo(null,[[x-10,z+65,8],[x+a,z+105,8]],'testo-2',1,.4);
    };
    vicino(380,12,0,1,true);vicino(780,12,2,1);vicino(780,410,2,0);
    box('clb.switch',200,240,120,260,32,'gt');
    for(let r=0;r<4;r++)for(let c=0;c<3;c++)box('clb.switch',215+c*28,270+r*48,12,12,3,'superficie',32);
    etichetta('clb.switch','switch matrix',260,355,48,true);
    box('clb.slice0',420,400,140,120,42,'slicem');box('clb.slice1',580,220,140,120,42,'slicel');
    for(const [id,x,z] of [['clb.slice0',420,400],['clb.slice1',580,220]])for(let r=0;r<2;r++)for(let c=0;c<2;c++)box(id,x+18+c*58,z+18+r*49,45,35,6,'slicel',42);
    etichetta('clb.slice0',dati.nodi['clb.slice0'].titolo,490,460,63,true);etichetta('clb.slice1',dati.nodi['clb.slice1'].titolo,650,280,63,true);
    filo('clb.switch',[[320,455,19],[420,455,19]],'testo-2',2);
    filo('clb.switch',[[320,280,19],[360,280,19],[580,280,19]],'testo-2',2);
    for(const [x,alto,basso,meta] of [[490,400,520,144],[650,220,340,82]]){
      filo('clb.carry',[[x,basso+70,20],[x,basso,20]],'clock',3);
      filo('clb.carry',[[x,alto,20],[x,meta,20]],'clock',3);
      trapezio('clb.carry',x-6,meta,12,14,5,'clock',20);
      etichetta('clb.carry','CIN',x+32,basso+35,40);etichetta('clb.carry','COUT',x+38,alto-55,40);
    }
    box('clb.nomi',465,538,155,5,2,'gt');box('clb.nomi',625,358,155,5,2,'gt');
    etichetta('clb.nomi','SLICE_X0Y0',545,550,35,true);etichetta('clb.nomi','SLICE_X1Y0',705,370,35,true);
  };

  costruisci.slice = () => {
    pedana(1120,750);
    const memoria=modello.stato.variante==='SLICEM';
    for(const [i,c] of ['D','C','B','A'].entries()){
      const z=80+i*200;ingressoLut('slice.lut',120,z,160,130,c,memoria?'slicem':'slicel');
      etichetta('slice.lut','A1–A6',66,z+65,12);etichetta('slice.lut','O6',305,z+30,26);etichetta('slice.lut','O5',305,z+100,26);
      if(memoria){filo('slice.lut',[[145,z+130,12],[145,z+163,12]],'memoria',2);filo('slice.lut',[[235,z+130,12],[235,z+163,12]],'memoria',2);etichetta('slice.lut','DI · WE',190,z+160,28);}
      for(const [x,nome] of [[720,'FF/Latch'],[820,'FF']]){
        box('slice.ff',x,z+40,70,50,32,'slicel');box('slice.ff',x+5,z+45,60,40,3,'slicem',32);etichetta('slice.ff',nome,x+35,z+65,48,true);
      }
      filo('slice.ff',[[650,z+65,17],[720,z+65,17]],'testo-2',1.5);filo('slice.ff',[[790,z+65,17],[820,z+65,17]],'testo-2',1.5);filo('slice.ff',[[890,z+65,17],[940,z+65,17]],'testo-2',1.5);
    }
    if(memoria){etichetta('slice.lut','RAM distribuita',435,100,45);etichetta('slice.lut','Shift register',435,130,45);}
    for(const [x,z,nome] of [[340,230,'F7BMUX'],[340,630,'F7AMUX'],[450,430,'F8MUX']]){
      trapezio('slice.mux',x,z-35,45,70,24,'slicel');etichetta('slice.mux',nome,x+22,z+60,40,true);
    }
    for(const [z,fine] of [[115,210],[315,250],[515,610],[715,650]])filo('slice.mux',[[310,z,12],[328,z,12],[328,fine,12],[340,fine,12]],'testo-2',1.5);
    filo('slice.mux',[[385,230,12],[410,230,12],[410,410,12],[450,410,12]],'testo-2',1.5);
    filo('slice.mux',[[385,630,12],[410,630,12],[410,450,12],[450,450,12]],'testo-2',1.5);
    box('slice.carry',560,80,80,730,8,'superficie');
    for(let i=0;i<4;i++){
      const z=110+i*200;box('slice.carry',566,z,68,48,28,'cmt',8);etichetta('slice.carry','MUXCY',600,z+24,48);
      cilindro('slice.carry',600,z+78,20,20,'cmt',8);etichetta('slice.carry','XOR',600,z+78,40);
      if(i<3)filo('slice.carry',[[600,z+200,18],[600,z+100,18]],'clock',2.5);
    }
    filo('slice.carry',[[600,850,18],[600,810,18]],'clock',3);filo('slice.carry',[[600,80,18],[600,42,18]],'clock',3);
    etichetta('slice.carry','CIN',645,835,40);etichetta('slice.carry','COUT',645,50,40);
    filo('slice.ctrl',[[680,860,3],[1070,860,3]],'clock',2.5);
    for(let j=0;j<3;j++){
      const x=680+j*11;filo('slice.ctrl',[[x,860,3],[x,185+j*10,3]],'clock',1.3);
      for(let i=0;i<4;i++){const z=170+i*200;for(const xx of [735+j*15,835+j*15])filo('slice.ctrl',[[x,z+20+j*10,3],[xx,z+20+j*10,3],[xx,z,3]],'clock',1.3);}
    }
    etichetta('slice.ctrl','CLK · CE · SR',955,855,26,true);
  };

  costruisci.lut = () => {
    pedana(1120,650);
    for(const z of [80,420]){
      box('lut.o5o6',250,z,300,250,12,'slicel');cornice('lut.o5o6',250,z,300,250,14,'slicem');
      for(let r=0;r<4;r++)for(let c=0;c<8;c++)box('lut.sram',280+c*30,z+80+r*30,27,27,14,'memoria',13);
      etichetta('lut.o5o6','LUT',400,z+36,35);
    }
    for(let i=0;i<5;i++){
      const z=135+i*35;filo('lut.o5o6',[[115,z,6],[150+i*15,z,6],[150+i*15,z+340,6],[250,z+340,6]],'testo-2',1.4);filo('lut.o5o6',[[150+i*15,z,6],[250,z,6]],'testo-2',1.4);etichetta('lut.o5o6','I'+i,85,z,22,true);
    }
    trapezio('lut.mux',650,260,80,240,34,'slicel');
    filo('lut.mux',[[550,205,15],[610,205,15],[610,310,15],[650,310,15]],'testo-2',2);
    filo('lut.mux',[[550,545,15],[610,545,15],[610,450,15],[650,450,15]],'testo-2',2);
    filo('lut.mux',[[690,120,17],[690,275,17]],'clock',2);etichetta('lut.mux','I5',690,95,37,true);
    filo('lut.mux',[[730,380,17],[940,380,17]],'testo-2',2);etichetta('lut.mux','O6',980,380,37,true);
    filo('lut.o5o6',[[550,545,15],[850,545,15],[850,600,15],[940,600,15]],'testo-2',2);etichetta('lut.o5o6','O5',980,600,37,true);
    const modo=modello.stato.modo;
    if(modo==='lut.distram'||modo==='lut.srl'){
      const nomi=modo==='lut.distram'?['DI','WE','CLK']:['D','CLK'];
      nomi.forEach((n,i)=>{filo('lut.sram',[[820,145+i*55,20],[580+i*12,145+i*55,20],[580+i*12,205+i*55,20],[550,205+i*55,20]],'memoria',2);etichetta('lut.sram',n,850,145+i*55,42,true);});
    }
    for(const [i,[id,nome]] of [['lut','Logica'],['lut.rom','ROM'],['lut.distram','RAM distribuita'],['lut.srl','Shift register']].entries()){
      const x=80+i*280;box(id,x,710,250,60,16,modo===id?'slicem':'superficie');etichetta(id,nome,x+125,736,35,true);
    }
  };

  function laterale(id) {
    pedana(1160,620);
    if(id==='bram'){
      box(id,330,185,360,360,45,'memoria');
      for(let r=0;r<8;r++)for(let c=0;c<8;c++)box(id,349+c*41,204+r*41,33,33,7,'slicem',45);
      for(const [x,nome] of [[150,'Porta A'],[840,'Porta B']]){
        box(id,x-60,300,120,110,28,'io');etichetta(id,nome,x,355,45,true);
        filo(id,[[x<500?210:780,355,15],[x<500?330:690,355,15]],'testo-2',2);
      }etichetta(id,'BRAM',510,145,75,true);
    }else if(id==='dsp'){
      const parole=['pre-sommatore da 25 bit','moltiplicatore 25 × 18','sommatore e un accumulatore a 48 bit','rilevatore di configurazioni'];
      parole.forEach((p,i)=>{const testo=dati.nodi.dsp.spiegazione[0],indice=testo.indexOf(p);box(id,55+i*280,300,240,140,45,'dsp');etichetta(id,testo.slice(indice,indice+p.length),175+i*280,370,70,true);if(i<3)filo(id,[[295+i*280,370,23],[335+i*280,370,23]],'testo-2',2);});
      filo(id,[[175,590,22],[175,440,22]],'dsp',3);filo(id,[[1015,300,22],[1015,170,22]],'dsp',3);
    }else if(id==='iob'){
      box(id,225,200,230,330,24,'io');trapezio(id,280,320,110,100,32,'superficie',24);etichetta(id,'IOB',340,240,52,true);
      filo(id,[[90,370,40],[280,370,40]],'testo-2',2);etichetta(id,'D',80,350,60);
      filo(id,[[340,280,40],[340,346,40]],'clock',2);etichetta(id,'EN',340,275,70);
      filo(id,[[390,370,40],[730,370,40]],'testo-2',2);cilindro(id,770,370,40,28,'metallo',22);etichetta(id,'Pin',770,370,65,true);
      filo(id,[[730,370,40],[730,480,40],[340,480,40],[340,420,40]],'testo-2',2);etichetta(id,'Z',540,345,60);
    }else if(id==='cmt'){
      box(id,120,210,260,320,22,'cmt');box(id,160,285,180,70,26,'slicel',22);box(id,160,405,180,70,26,'slicem',22);
      etichetta(id,'CMT',250,245,55,true);etichetta(id,'MMCM',250,320,70,true);etichetta(id,'PLL',250,440,70,true);
      filo(id,[[380,370,23],[500,370,23]],'clock',3);trapezio(id,500,335,60,70,22,'cmt',15);etichetta(id,'BUFG',530,435,50,true);
      filo(id,[[560,370,23],[1050,370,23]],'clock',3);
      for(const x of [690,850,1010]){filo(id,[[x,240,23],[x,540,23]],'clock',2);for(const z of [250,500]){box(id,x-30,z,60,45,24,'slicel',24);etichetta(id,'FF',x,z+22,65);}}
      etichetta(id,'HROW',845,340,50,true);
    }else if(id==='interconnessione'){
      for(let r=0;r<4;r++)for(let c=0;c<4;c++){
        const x=180+c*220,z=170+r*120;box(id,x,z,120,70,30,'slicel');etichetta(id,'CLB',x+60,z+35,47);
        box(id,x-35,z+70,30,30,18,'gt');filo(id,[[x-20,z+85,8],[x,z+35,8]],'testo-2',1.5);
        if(c<3)filo(id,[[x-20,z+85,8],[x+200,z+85,8]],'clock',2);if(r<3)filo(id,[[x-20,z+85,8],[x-20,z+205,8]],'clock',2);
      }
    }else if(id==='configurazione'){
      box(id,300,180,500,380,26,'chip');etichetta(id,'ARTIX-7',550,365,52,true);
      const celle=[[330,210],[480,210],[630,210],[750,270],[750,490],[600,530],[450,530],[330,480]];
      celle.forEach(([x,z],i)=>{box(id,x-18,z-18,36,36,18,'slicel',26);if(i)filo(id,[[...celle[i-1],37],[x,z,37]],'clock',2);});
      filo(id,[[120,210,36],[312,210,36]],'clock',2);etichetta(id,'TDI',105,185,50,true);
      filo(id,[[312,480,36],[120,480,36]],'clock',2);etichetta(id,'TDO',100,510,50,true);
      filo(id,[[550,610,36],[550,560,36]],'clock',2);etichetta(id,'TCK',550,630,50);
      cilindro(id,920,405,12,10,'inattivo');etichetta(id,'DONE',920,365,35);
    }else if(id==='flusso'){
      dati.nodi.flusso.passi.forEach((p,i)=>{const x=i%4*285+30,z=i<4?190:450;box(id,x,z,255,140,35,i===6?'memoria':i<3?'cmt':'slicel');etichetta(id,p.nome,x+127,z+70,62,true);if(i!==3&&i!==6)filo(id,[[x+255,z+70,15],[x+285,z+70,15]],'testo-2',2);if(i===3)filo(id,[[x+127,z+140,15],[x+127,410,15],[157,410,15],[157,450,15]],'testo-2',2);});
    }
  }

  return renderer;
}
