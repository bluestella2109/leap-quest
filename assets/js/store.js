(() => {
  const KEY='leap-quest-v2';
  const initial={profile:{userId:'',level:1,exp:0,mastered:[],review:[],answered:0,correct:0,history:[]},words:[],session:null,customWords:[]};
  function load(){try{return {...structuredClone(initial),...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{return structuredClone(initial)}}
  let data=load();
  function save(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){console.warn('Local save failed',e)}}
  window.LQStore={get data(){return data},save,reset(){data=structuredClone(initial);save()},setSession(s){data.session=s;save()},clearSession(){data.session=null;save()},setProfile(p){data.profile={...data.profile,...p};save()},addWord(w){data.customWords.push({...w,id:crypto.randomUUID(),custom:true});save()},setWords(w){data.words=w;save()},allWords(){return [...data.words,...data.customWords]},updateWord(id,patch){for(const list of [data.words,data.customWords]){const i=list.findIndex(w=>String(w.id)===String(id)||w.english===id);if(i>=0)list[i]={...list[i],...patch}}save()},record(answer){const p=data.profile;p.answered++;if(answer.correct)p.correct++;p.exp+=answer.correct?answer.points||10:0;p.level=Math.floor(p.exp/100)+1;p.history.unshift({...answer,at:Date.now()});p.history=p.history.slice(0,1000);save()},setRankingCache(rows){data.rankingCache=rows;save()}};
})();
