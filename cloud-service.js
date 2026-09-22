/* Firebase transport, isolated from the MegaSpeedruns application. */
window.PackCloud = (() => {
  const config = {apiKey:'AIzaSyC2pHhSThFkKhN-c1sdhUATt1-zmNLV9sw',authDomain:'megaspeedrunsdatabase.firebaseapp.com',databaseURL:'https://megaspeedrunsdatabase-default-rtdb.firebaseio.com',projectId:'megaspeedrunsdatabase',storageBucket:'megaspeedrunsdatabase.firebasestorage.app',messagingSenderId:'545413984550',appId:'1:545413984550:web:79c899026a21f6343091e7'};
  let ready;
  async function sdk(){
    if(!ready)ready=(async()=>{
      const base='https://www.gstatic.com/firebasejs/12.19.0/';
      const [app,auth,db,storage]=await Promise.all(['app','auth','database','storage'].map(n=>import(base+'firebase-'+n+'.js')));
      const project=app.initializeApp(config,'level-pack-creator');
      return {auth,db,storage,userAuth:auth.getAuth(project),database:db.getDatabase(project),bucket:storage.getStorage(project)};
    })().catch(e=>{ready=null;throw e});
    return ready;
  }
  const slugify=name=>name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70);
  async function user(s){await s.userAuth.authStateReady();return s.userAuth.currentUser||(await s.auth.signInAnonymously(s.userAuth)).user;}
  async function list(){const s=await sdk();const snap=await s.db.get(s.db.ref(s.database,'levelPackCreator/packs'));return Object.entries(snap.val()||{}).filter(([,p])=>p.manifestPath).map(([slug,p])=>({...p,slug})).sort((a,b)=>b.updatedAt-a.updatedAt);}
  async function load(slug){
    const s=await sdk();const record=(await s.db.get(s.db.ref(s.database,'levelPackCreator/packs/'+slug))).val();
    if(!record?.manifestPath)throw Error('Pack not found.');
    const url=await s.storage.getDownloadURL(s.storage.ref(s.bucket,record.manifestPath));
    const response=await fetch(url);if(!response.ok)throw Error('Pack could not be loaded.');
    const pack=await response.json();if(!Array.isArray(pack.levels))throw Error('Invalid pack.');
    return {...pack,cloudSlug:slug,cloudName:record.name,cloudOwner:record.owner,cloudRevision:record.updatedAt};
  }
  async function publish(pack,name,progress){
    const s=await sdk(),account=await user(s);const slug=pack.cloudSlug||slugify(name);
    if(!slug||['index','404'].includes(slug))throw Error('Choose another pack name.');
    const recordRef=s.db.ref(s.database,'levelPackCreator/packs/'+slug);
    const claim=await s.db.runTransaction(recordRef,current=>{
      if(current&&current.owner!==account.uid)return;
      return current||{owner:account.uid,name,updatedAt:Date.now()};
    });
    if(!claim.committed)throw Error('That pack name belongs to another uploader. Choose a different name.');
    const builtins=new Set(await (await fetch(new URL('builtin-assets.json',document.baseURI))).json());
    const builtinHashes=await (await fetch(new URL('builtin-asset-hashes.json',document.baseURI))).json();
    const root='levelPackCreator/'+account.uid+'/'+slug+'/';
    async function upload(blob,extension){
      if(blob.size>100*1024*1024)throw Error('A file exceeds the 100 MB upload limit.');
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
      if(extension!=='mmlv'&&builtinHashes[hash])return builtinHashes[hash];
      const ref=s.storage.ref(s.bucket,root+'assets/'+hash+'.'+extension);
      try{return await s.storage.getDownloadURL(ref);}catch(e){if(e.code!=='storage/object-not-found')throw e;}
      await s.storage.uploadBytes(ref,blob,{contentType:blob.type||'application/octet-stream'});return s.storage.getDownloadURL(ref);
    }
    async function asset(path){
      if(!path)return '';
      const relative=path.replace(/^\.\//,'');
      if(builtins.has(relative)||[...builtins].some(f=>f.replace(/\.[^.]+$/,'')===relative))return relative;
      if(/^https:\/\/firebasestorage\.googleapis\.com\//.test(path))return path;
      if(!/^(data:|blob:|https?:)/.test(path)&&!relative.startsWith('images/')&&!relative.startsWith('music/')&&!relative.startsWith('sounds/'))throw Error('Choose the custom asset with Pick File before saving.');
      const response=await fetch(path);if(!response.ok)throw Error('A custom asset could not be read. Select it using Pick File.');
      const blob=await response.blob();const ext=({'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','audio/mpeg':'mp3','audio/wav':'wav','audio/ogg':'ogg'})[blob.type]||'bin';return upload(blob,ext);
    }
    const result=structuredClone(pack);
    for(const key of ['titleBackground','selectBackground','wilyBackground','victoryBackground','wilyIcon']){progress('Uploading assets…');result[key]=await asset(result[key]);}
    for(const key of Object.keys(result.music||{}))result.music[key]=await asset(result.music[key]);
    for(const level of result.levels){
      if(level.customMugshot)level.image=await asset(level.image);
      if(level.localLevelData){progress('Uploading level files…');level.localLevelUrl=await upload(new Blob([level.localLevelData],{type:'text/plain'}),'mmlv');delete level.localLevelData;}
    }
    result.cloudSlug=slug;result.cloudName=name;result.cloudOwner=account.uid;
    const manifestPath=root+'packs/'+crypto.randomUUID()+'.json';
    progress('Saving pack…');await s.storage.uploadBytes(s.storage.ref(s.bucket,manifestPath),new Blob([JSON.stringify(result)],{type:'application/json'}));
    const updatedAt=Date.now();await s.db.set(recordRef,{owner:account.uid,name,manifestPath,updatedAt});
    return {...result,cloudRevision:updatedAt};
  }
  return {list,load,publish,slugify};
})();
