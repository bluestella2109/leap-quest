import { WORDS } from "./words.js";
const API_URL=window.LEAP_SHEET_API_URL||localStorage.getItem('leap-sheet-api-url')||'';
const $=id=>document.getElementById(id),defaultAvatar='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#2c4664"/><rect x="24" y="16" width="48" height="16" fill="#ffd166"/><rect x="16" y="32" width="64" height="32" fill="#75f0bf"/><rect x="24" y="40" width="8" height="8" fill="#15243a"/><rect x="64" y="40" width="8" height="8" fill="#15243a"/><rect x="32" y="64" width="32" height="8" fill="#ffd166"/></svg>');
let user=null,profile=null,soundOn=true,wordPage=0,selectedMode='battle',difficulty='normal',questionTimer=null,sidebarCollapsed=false;
let typingState={list:[],index:0,score:0,correct:0,answered:false},focusState={list:[],index:0,seconds:15,remaining:15,paused:false,running:false,interval:null,meaningMode:'show',autoDelay:3,meaningVisible:true,autoTimer:null},study={list:[],index:0,flipped:false},quiz={list:[],index:0,score:0,combo:0,correct:0,answered:false,mode:'battle'},local=loadLocal();
const DIFFICULTIES={easy:{label:'かんたん',seconds:15,multiplier:1},normal:{label:'ふつう',seconds:10,multiplier:1.5},hard:{label:'むずかしい',seconds:6,multiplier:2.5}};
function loadLocal(){try{return {...{exp:0,answered:0,correct:0,mastered:[],review:[],bestCombo:0,sessions:0,lastLog:''},...JSON.parse(localStorage.getItem('leap-quest-local')||'{}')}}catch{return {exp:0,answered:0,correct:0,mastered:[],review:[],bestCombo:0,sessions:0,lastLog:''}}}
function saveLocal(){localStorage.setItem('leap-quest-local',JSON.stringify(local));updateStats();if(user&&profile)syncProgress().catch(console.error)}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2300)}
function sfx(kind){if(!soundOn)return;try{const C=window.AudioContext||window.webkitAudioContext;let c=window._lqAudio||(window._lqAudio=new C()),o=c.createOscillator(),g=c.createGain(),t=c.currentTime;o.connect(g);g.connect(c.destination);o.type='square';o.frequency.setValueAtTime(kind==='hit'?240:kind==='bad'?130:kind==='level'?800:540,t);o.frequency.exponentialRampToValueAtTime(kind==='hit'?85:kind==='bad'?75:kind==='level'?1300:850,t+.13);g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.001,t+.16);o.start();o.stop(t+.17)}catch{}}
function updateStats(){let level=Math.floor(local.exp/100)+1;$('topLevel').textContent=String(level).padStart(2,'0');$('topExp').textContent=String(local.exp).padStart(3,'0');$('topMastered').textContent=local.mastered.length;$('masteryBar').style.width=(local.mastered.length/WORDS.length*100)+'%';$('masteryPercent').textContent=Math.round(local.mastered.length/WORDS.length*100)+'% MASTERED';$('homeLog').textContent=local.lastLog||'まだ冒険ログがありません。最初のクエストに出発しよう。';if(profile){$('profileLevel').textContent=level;$('profileExp').textContent=local.exp;$('profileMastered').textContent=local.mastered.length;$('profileAccuracy').textContent=(local.answered?Math.round(local.correct/local.answered*100):0)+'%'}}

// ③ サイドボード折りたたみ制御
function setSidebarCollapsed(collapse){
  sidebarCollapsed=collapse;
  $('sidebar').classList.toggle('collapsed',sidebarCollapsed);
  $('appRoot').classList.toggle('sidebar-collapsed',sidebarCollapsed);
  $('sidebarToggle').textContent=sidebarCollapsed?'▶ ≡':'◀ ≡';
}
$('sidebarToggle').onclick=()=>setSidebarCollapsed(!sidebarCollapsed);

function switchPage(name,direct=false){
  if(name==='battle'&&!direct){selectedMode='battle';name='games'}
  if(name==='typing'&&!direct){selectedMode='typing';name='games'}
  if(!$('page-'+name))return;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===name));
  $('page-'+name).classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  const tr=$('transition');tr.classList.remove('done');requestAnimationFrame(()=>setTimeout(()=>tr.classList.add('done'),80));
  
  // ゲーム時や学習時は自動で開始時に折りたたむ (③)
  if(name==='battle'||name==='typing'||name==='timer'||name==='study'){
    setSidebarCollapsed(true);
  } else {
    setSidebarCollapsed(false);
  }

  if(name==='library')renderLibrary();
  if(name==='ranking')loadRanking();
  if(name==='profile')renderProfile();
}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>switchPage(b.dataset.page)));setTimeout(()=>$('transition').classList.add('done'),500);
$('soundToggle').onclick=()=>{soundOn=!soundOn;$('soundToggle').textContent='SOUND '+(soundOn?'ON':'OFF');if(soundOn)sfx('ok')};

function clampRange(startId,endId){let a=Math.max(1,Math.min(2300,Number($(startId).value)||1)),b=Math.max(1,Math.min(2300,Number($(endId).value)||2300));if(a>b)[a,b]=[b,a];$(startId).value=a;$(endId).value=b;return WORDS.filter(w=>w.id>=a&&w.id<=b)}
function shuffle(arr){arr=[...arr];for(let i=arr.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}

// --- ①, ④ バトルゲーム ---
function beginBattle(custom=null){
  let pool=custom||clampRange('rangeStart','rangeEnd');
  let count=Number($('questionCount').value)||10;
  quiz={list:shuffle(pool).slice(0,count),index:0,score:0,combo:0,correct:0,answered:false,mode:custom?'review':'battle'};
  if(!quiz.list.length){toast('出題できる単語がありません');return}
  switchPage('battle',true);
  $('battleResult').classList.add('hidden');
  $('choices').classList.remove('hidden');
  $('nextQuestion').classList.add('hidden');
  $('backHome').classList.remove('hidden');
  $('detailBox').classList.add('hidden');
  $('screenPopup').classList.add('hidden');
  renderQuestion();
  local.sessions++;saveLocal();
}

function renderQuestion(){
  clearInterval(questionTimer);
  const w=quiz.list[quiz.index];
  if(!w){finishBattle();return}
  quiz.answered=false;
  $('questionProgress').textContent=`QUEST ${String(quiz.index+1).padStart(2,'0')} / ${quiz.list.length}`;
  $('combo').textContent=quiz.combo;
  $('battleScore').textContent='SCORE '+quiz.score;
  $('quizWord').textContent=w.word;
  $('battleFeedback').textContent='正しい意味を選択して攻撃！';
  $('nextQuestion').classList.add('hidden');$('detailBox').classList.add('hidden');
  $('screenPopup').classList.add('hidden');$('choices').innerHTML='';
  $('enemySprite').textContent=['◆','♟','☠','▲','✦'][Math.floor(Math.random()*5)];$('enemyName').textContent=['WORD SLIME','DARK KNIGHT','MIMIC','SHADOW','BOSS'][Math.floor(Math.random()*5)];
  $('enemyHp').style.width='100\%';$('playerHp').style.width='100%';
  let opts=shuffle([w,...shuffle(WORDS.filter(x=>x.id!==w.id&&x.meaning!==w.meaning)).slice(0,3)]);
  opts.forEach(o=>{
    let b=document.createElement('button');b.className='choice';b.textContent=o.meaning;
    b.onclick=()=>answer(o.id===w.id,b,w);
    $('choices').appendChild(b);
  });
  startBattleTimer(w);
}

function startBattleTimer(w){
  clearInterval(questionTimer);
  let remain=DIFFICULTIES[difficulty].seconds;
  $('battleFeedback').textContent=`制限時間 ${remain} 秒！意味を選んで攻撃！`;
  questionTimer=setInterval(()=>{
    remain-=.1;
    $('battleFeedback').textContent=`残り ${Math.max(0,remain).toFixed(1)} 秒！意味を選んで攻撃！`;
    if(remain<=0){clearInterval(questionTimer);answer(false,null,w,true)}
  },100);
}

function animationHit(combo){
  $('battleFlash').classList.remove('play');$('damage').classList.remove('play');$('comboPop').classList.remove('play');$('enemySprite').classList.remove('hit');
  void $('battleFlash').offsetWidth;
  $('battleFlash').classList.add('play');
  $('damage').textContent='+'+(100+Math.min(combo,10)*25);$('damage').classList.add('play');
  $('enemySprite').classList.add('hit');$('enemySprite').animate([{transform:'translateX(0) scale(1)'},{transform:'translateX(-12px) scale(1.15)'},{transform:'translateX(10px) scale(.95)'},{transform:'translateX(0) scale(1)'}],{duration:330,easing:'steps(4)'});
  if(combo>=2){$('comboPop').textContent=combo+' HIT COMBO!';$('comboPop').classList.add('play')}
  sfx('hit');
}

function answer(ok,btn,w,timedOut=false){
  if(quiz.answered)return;
  clearInterval(questionTimer);
  quiz.answered=true;
  local.answered++;
  
  const popup=$('screenPopup');
  const detailBox=$('detailBox');
  const detailContent=$('detailContent');

  if(ok){
    local.correct++;quiz.correct++;quiz.combo++;
    let base=100+Math.min(quiz.combo,10)*10;
    quiz.score+=Math.round(base*DIFFICULTIES[difficulty].multiplier);
    let gain=Math.round((10+Math.min(quiz.combo,5)*2)*DIFFICULTIES[difficulty].multiplier);
    local.exp+=gain;
    local.mastered=[...new Set([...local.mastered,w.id])];
    
    // ④ 正解が画面に大きく表示
    popup.textContent='✨ 正解！ (+'+gain+' EXP) ✨';
    popup.className='screen-popup correct show';
    $('battleFeedback').textContent=`正解！ ${w.word} = ${w.meaning}`;
    if(btn)btn.classList.add('correct');
    $('enemyHp').style.width='0%';
    animationHit(quiz.combo);
    if(quiz.combo===5||quiz.combo===10){toast('SPECIAL COMBO!!');sfx('level')}
  }else{
    quiz.combo=0;
    local.review=[...new Set([...local.review,w.id])];
    
    // ④ 不正解時に大きく表示 ＆ 解説・詳細を同時に表示
    popup.textContent='💥 不正解… 💥';
    popup.className='screen-popup wrong show';
    $('battleFeedback').textContent=timedOut?`時間切れ！ 正解は ${w.word}（${w.meaning}）。`:`ミス！ 正解は「${w.meaning}」。`;
    $('playerHp').style.width='50%';
    if(btn)btn.classList.add('wrong');
    [...$('choices').children].forEach(c=>{if(c.textContent===w.meaning)c.classList.add('correct')});
    
    detailBox.classList.remove('hidden');
    detailContent.innerHTML=`<b>No.${w.id} : ${w.word}</b><br>意味：${w.meaning}<br><span style="color:var(--muted)">【詳細解説】この単語はLEAP頻出の重要語です。復習リストに登録されたので後で図鑑から再確認しましょう。</span>`;
    sfx('bad');
  }

  [...$('choices').children].forEach(c=>c.disabled=true);$('combo').textContent=quiz.combo;
  $('battleScore').textContent='SCORE '+quiz.score;
  $('nextQuestion').classList.remove('hidden');$('nextQuestion').textContent=quiz.index===quiz.list.length-1?'結果を見る ▶':'次の敵へ ▶';
  
  local.lastLog=`直近の冒険：${quiz.index+1}問中${quiz.correct}問正解、${quiz.score} SCORE`;
  saveLocal();

  // ④ 数秒経ったら自動で次の画面に行く（正解時は2.2秒後、不正解時は4秒後など）
  let autoWait = ok ? 2200 : 4000;
  setTimeout(()=>{
    if(quiz.answered && $('page-battle').classList.contains('active')){
      quiz.index++;
      renderQuestion();
    }
  }, autoWait);
}

$('startBattle').onclick=()=>{$('gameRangeStart').value=$('rangeStart').value;$('gameRangeEnd').value=$('rangeEnd').value;$('gameQuestionCount').value=$('questionCount').value;chooseDifficulty('battle')};$('nextQuestion').onclick=()=>{clearInterval(questionTimer);quiz.index++;renderQuestion()};
$('backHome').onclick=()=>switchPage('home');$('againBattle').onclick=()=>beginBattle();


// --- ⑤ 独自キーボード制御 & タイピングゲーム ---
document.querySelectorAll('.vk-key').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const char=btn.dataset.char;
    const action=btn.dataset.action;
    const input=$('typingAnswer');
    if(!input || input.disabled)return;
    if(char){
      input.value += char;
      sfx('ok');
    } else if(action==='backspace'){
      input.value = input.value.slice(0, -1);
      sfx('ok');
    } else if(action==='enter'){
      $('typingForm').requestSubmit();
    }
  });
});

function startTypingGame(){
  clearInterval(typingState.interval);
  const pool=clampRange('typingStart','typingEnd');
  typingState={list:shuffle(pool).slice(0,Number($('typingCount').value)||10),index:0,score:0,correct:0,answered:false,interval:null};
  if(!typingState.list.length)return toast('出題範囲を確認してね');
  $('typingResult').classList.add('hidden');$('typingArena').classList.remove('finished');
  $('typingNext').classList.add('hidden');$('typingForm').classList.remove('hidden');
  $('virtualKeyboard').classList.remove('hidden');$('typingAnswer').disabled=false;
  $('typingDetailBox').classList.add('hidden');
  $('typingScreenPopup').classList.add('hidden');$('typingDifficultyLabel').textContent=DIFFICULTIES[difficulty].label.toUpperCase()+' ×'+DIFFICULTIES[difficulty].multiplier;
  switchPage('typing',true);
  renderTypingQuestion();
  local.sessions++;saveLocal();
}

function renderTypingQuestion(){
  clearInterval(typingState.interval);
  const w=typingState.list[typingState.index];
  if(!w){finishTyping();return}
  typingState.answered=false;
  $('typingProgress').textContent=`QUEST ${typingState.index+1} / ${typingState.list.length}`;
  $('typingScore').textContent=typingState.score;
  $('typingMeaning').textContent=w.meaning;
  $('typingAnswer').value='';$('typingFeedback').textContent='意味に合う英単語を下の独自キーボードで入力！';
  $('typingNext').classList.add('hidden');
  $('typingDetailBox').classList.add('hidden');$('typingScreenPopup').classList.add('hidden');
  let left=DIFFICULTIES[difficulty].seconds;
  const total=left;
  $('typingTime').textContent=left.toFixed(1);$('typingTimerBar').style.width='100%';
  typingState.interval=setInterval(()=>{
    left-=.1;
    $('typingTime').textContent=Math.max(0,left).toFixed(1);$('typingTimerBar').style.width=Math.max(0,left/total*100)+'%';
    if(left<=0){clearInterval(typingState.interval);submitTyping(true)}
  },100);
}

$('typingForm').addEventListener('submit',e=>{e.preventDefault();submitTyping(false)});

function submitTyping(timedOut){
  if(typingState.answered)return;
  typingState.answered=true;
  clearInterval(typingState.interval);
  const w=typingState.list[typingState.index],answer=$('typingAnswer').value.trim().toLowerCase(),ok=!timedOut&&answer===w.word.toLowerCase();
  local.answered++;
  
  const popup=$('typingScreenPopup');
  const detailBox=$('typingDetailBox');
  const detailContent=$('typingDetailContent');

  if(ok){
    typingState.correct++;local.correct++;
    const points=Math.round(100*DIFFICULTIES[difficulty].multiplier);
    typingState.score+=points;
    local.exp+=Math.max(1,Math.round(10*DIFFICULTIES[difficulty].multiplier));
    local.mastered=[...new Set([...local.mastered,w.id])];
    
    popup.textContent='✨ 正解！ (+'+points+' pt) ✨';
    popup.className='screen-popup correct show';
    $('typingFeedback').textContent=`正解！ ${w.word} · +${points} pt`;
    sfx('hit');
  }else{
    local.review=[...new Set([...local.review,w.id])];
    popup.textContent='💥 不正解… 💥';
    popup.className='screen-popup wrong show';
    $('typingFeedback').textContent=(timedOut?'時間切れ！ ':'不正解。 ')+`正解は ${w.word}（${w.meaning}）`;
    
    detailBox.classList.remove('hidden');
    detailContent.innerHTML=`<b>No.${w.id} : ${w.word}</b><br>意味：${w.meaning}<br><span style="color:var(--muted)">【詳細解説】入力ミスや制限時間切れです。正しいつづり（${w.word}）を確認しましょう。</span>`;
    sfx('bad');
  }
  $('typingAnswer').disabled=true;
  $('typingScore').textContent=typingState.score;
  $('typingNext').classList.remove('hidden');$('typingNext').textContent=typingState.index===typingState.list.length-1?'結果を見る ▶':'次の問題 ▶';
  saveLocal();

  let autoWait = ok ? 2200 : 4000;
  setTimeout(()=>{
    if(typingState.answered && $('page-typing').classList.contains('active')){
      nextTyping();
    }
  }, autoWait);
}

function nextTyping(){clearInterval(typingState.interval);typingState.index++;renderTypingQuestion()}
$('typingNext').onclick=nextTyping;
$('typingAgain').onclick=startTypingGame;

function finishTyping(){
  clearInterval(typingState.interval);
  $('typingForm').classList.add('hidden');$('virtualKeyboard').classList.add('hidden');
  $('typingNext').classList.add('hidden');$('typingResult').classList.remove('hidden');
  const acc=Math.round(typingState.correct/typingState.list.length*100);
  $('typingResultTitle').textContent=acc>=80?'TYPING MASTER!':acc>=50?'GOOD JOB!':'KEEP PRACTICING';$('typingResultText').textContent=`${typingState.list.length}問中 ${typingState.correct}問正解（${acc}%） · ${typingState.score} pt`;
  local.lastLog=`タイピング：${typingState.list.length}問中${typingState.correct}問正解 / ${typingState.score}pt`;
  saveLocal();
}


// --- ② タイマー学習の拡張 ---
$('timerMeaningMode').addEventListener('change',()=>{
  const mode=$('timerMeaningMode').value;
  $('autoDelayField').style.display=mode==='auto'?'grid':'none';
});

function startFocus(){
  stopFocus(false);
  const pool=clampRange('timerStart','timerEnd');
  let count=$('timerCount').value==='all'?pool.length:Number($('timerCount').value)||20;
  
  focusState={
    list:shuffle(pool).slice(0,count),
    index:0,
    seconds:Number($('timerSeconds').value)||15,
    remaining:Number($('timerSeconds').value)||15,
    paused:false,
    running:true,
    interval:null,
    meaningMode:$('timerMeaningMode').value,
    autoDelay:Number($('timerAutoDelay').value)||3,
    meaningVisible:false,
    autoTimer:null
  };
  if(!focusState.list.length)return toast('単語範囲を確認してね');
  ['timerPauseBtn','timerSkipBtn','timerStopBtn'].forEach(id=>$(id).disabled=false);$('timerStartBtn').disabled=true;
  renderFocusWord();
}

function renderFocusWord(){
  clearInterval(focusState.interval);
  clearTimeout(focusState.autoTimer);
  
  if(focusState.index>=focusState.list.length){
    stopFocus(false);
    $('focusWord').textContent='COMPLETE!';$('focusMeaning').textContent=`${focusState.list.length}語の学習が終了しました。`;
    toast('タイマー学習完了！');
    return;
  }
  
  const w=focusState.list[focusState.index];
  $('focusWord').textContent=w.word;
  
  // 意味表示モードの初期設定
  if(focusState.meaningMode==='show'){
    focusState.meaningVisible=true;
    $('focusMeaning').textContent=w.meaning;
  } else if(focusState.meaningMode==='tap'){
    focusState.meaningVisible=false;
    $('focusMeaning').textContent='【タップまたはボタンで意味を表示】';
  } else if(focusState.meaningMode==='auto'){
    focusState.meaningVisible=false;
    $('focusMeaning').textContent='（自動で表示されます…）';
    focusState.autoTimer=setTimeout(()=>{
      if(focusState.running && !focusState.paused){
        focusState.meaningVisible=true;
        $('focusMeaning').textContent=w.meaning;
      }
    }, focusState.autoDelay * 1000);
  }

  $('timerProgress').textContent=`WORD ${focusState.index+1} / ${focusState.list.length} · NO.${w.id}`;
  focusState.remaining=focusState.seconds;
  updateFocusTimer();
  if($('timerVoice').checked)speakWord(w.word);

  focusState.interval=setInterval(()=>{
    if(focusState.paused)return;
    focusState.remaining=Math.max(0,focusState.remaining-.1);
    updateFocusTimer();
    // 残り時間がなくなったら自動で次の単語へ
    if(focusState.remaining<=0){
      focusState.index++;
      renderFocusWord();
    }
  },100);
}

function updateFocusTimer(){
  $('timerCountdown').textContent=focusState.remaining.toFixed(1);$('focusTimerBar').style.width=(focusState.remaining/focusState.seconds*100)+'%';
}

$('focusToggleMeaning').onclick=()=>{
  const w=focusState.list[focusState.index];
  if(!w)return;
  focusState.meaningVisible=!focusState.meaningVisible;
  $('focusMeaning').textContent=focusState.meaningVisible?w.meaning:'【タップまたはボタンで意味を表示】';
};
// カード部分タップでも意味を表示できるように
document.querySelector('.focus-card').addEventListener('click',e=>{
  if(e.target.tagName==='BUTTON')return;
  const w=focusState.list[focusState.index];
  if(!w)return;
  if(focusState.meaningMode==='tap'){
    focusState.meaningVisible=!focusState.meaningVisible;
    $('focusMeaning').textContent=focusState.meaningVisible?w.meaning:'【タップまたはボタンで意味を表示】';
  }
});

function stopFocus(showToast=true){
  clearInterval(focusState.interval);
  clearTimeout(focusState.autoTimer);
  focusState.running=false;
  focusState.paused=false;
  if($('timerStartBtn'))$('timerStartBtn').disabled=false;
  ['timerPauseBtn','timerSkipBtn','timerStopBtn'].forEach(id=>{if($(id))$(id).disabled=true});
  if(showToast)toast('タイマー学習を終了しました');
}

$('timerStartBtn').onclick=startFocus;
$('timerPauseBtn').onclick=()=>{if(!focusState.running)return;focusState.paused=!focusState.paused;$('timerPauseBtn').textContent=focusState.paused?'再開':'一時停止'};
$('timerSkipBtn').onclick=()=>{if(focusState.running){focusState.index++;renderFocusWord()}};
$('timerStopBtn').onclick=()=>stopFocus(true);$('focusSpeak').onclick=()=>{const w=focusState.list[focusState.index];if(w)speakWord(w.word)};


// --- 記憶の書 & 単語一覧・ランキング ---
function startStudy(){let list=clampRange('studyStart','studyEnd');study={list:shuffle(list).slice(0,Number($('studyCount').value)||20),index:0,flipped:false};if(!study.list.length){toast('この範囲に単語がありません');return}renderStudy()}
function renderStudy(){let w=study.list[study.index];if(!w)return;$('studyNo').textContent=w.id;$('studyWord').textContent=w.word;$('studyMeaning').textContent=w.meaning;$('studyMeaning').classList.toggle('hidden',!study.flipped);$('flipStudy').textContent=study.flipped?'意味を隠す':'意味を表示';$('studyStatus').textContent=`${study.index+1} / ${study.list.length} 枚`}
$('startStudy').onclick=startStudy;$('flipStudy').onclick=()=>{study.flipped=!study.flipped;renderStudy()};$('studyPrev').onclick=()=>{if(study.list.length){study.index=(study.index-1+study.list.length)\%study.list.length;study.flipped=false;renderStudy()}};$('studyNext').onclick=()=>{if(study.list.length){study.index=(study.index+1)%study.list.length;study.flipped=false;renderStudy()}};$('studyKnown').onclick=()=>{let w=study.list[study.index];if(!w)return;local.mastered=[...new Set([...local.mastered,w.id])];local.exp+=3;saveLocal();toast('習得済みに登録 +3 EXP');study.index=(study.index+1)\%study.list.length;study.flipped=false;renderStudy()};$('studyMiss').onclick=()=>{let w=study.list[study.index];if(!w)return;local.review=[...new Set([...local.review,w.id])];saveLocal();toast('復習リストに登録');study.index=(study.index+1)%study.list.length;study.flipped=false;renderStudy()};

function speakWord(word){if(!('speechSynthesis'in window)){toast('このブラウザは読み上げに対応していません');return}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(word);u.lang='en-US';u.rate=.85;speechSynthesis.speak(u)}

function renderLibrary(){
  let q=$('searchWord').value.trim().toLowerCase(),range=clampRange('libStart','libEnd'),filter=$('libraryFilter')?.value||'all';
  let found=range.filter(w=>{
    const status=local.mastered.includes(w.id)?'mastered':local.review.includes(w.id)?'review':'unmarked';
    return(!q||String(w.id).includes(q)||w.word.toLowerCase().includes(q)||w.meaning.toLowerCase().includes(q))&&(filter==='all'||filter===status)
  }),pages=Math.max(1,Math.ceil(found.length/30));
  wordPage=Math.min(wordPage,pages-1);
  $('libraryCount').textContent=`${found.length.toLocaleString()}語が見つかりました`; 
  $('pageLabel').textContent=`${wordPage+1} / ${pages}`;
  $('wordList').innerHTML='';
  found.slice(wordPage*30,(wordPage+1)*30).forEach(w=>{
    let row=document.createElement('div');row.className='word-row '+(local.mastered.includes(w.id)?'is-mastered':local.review.includes(w.id)?'needs-review':'');
    let n=document.createElement('span');n.className='word-num';n.textContent=w.id;
    let word=document.createElement('b');word.textContent=w.word;
    let def=document.createElement('span');def.className='word-def';def.textContent=w.meaning;
    let actions=document.createElement('div');actions.className='word-actions';
    let speak=document.createElement('button');speak.className='tiny';speak.textContent='🔊';speak.title='英単語を読み上げ';speak.onclick=()=>speakWord(w.word);
    let review=document.createElement('button');review.className='tiny';review.textContent=local.review.includes(w.id)?'✓ 要復習':'＋ 復習';
    review.onclick=()=>{local.review=[...new Set([...local.review,w.id])];local.mastered=local.mastered.filter(id=>id!==w.id);saveLocal();renderLibrary();toast('要復習に登録')};
    let known=document.createElement('button');known.className='tiny';known.textContent=local.mastered.includes(w.id)?'★ 習得済み':'習得済みにする';
    known.onclick=()=>{local.mastered=[...new Set([...local.mastered,w.id])];local.review=local.review.filter(id=>id!==w.id);saveLocal();renderLibrary();toast('習得済みに登録')};
    actions.append(speak,review,known);row.append(n,word,def,actions);$('wordList').appendChild(row)
  })
}
$('searchWord').addEventListener('input',()=>{wordPage=0;renderLibrary()});
$('libraryFilter').addEventListener('change',()=>{wordPage=0;renderLibrary()});$('applyLibraryRange').onclick=()=>{wordPage=0;renderLibrary()};
$('prevPage').onclick=()=>{wordPage=Math.max(0,wordPage-1);renderLibrary()};$('nextPage').onclick=()=>{wordPage++;renderLibrary()};

function chooseDifficulty(mode){selectedMode=mode;document.querySelectorAll('.difficulty-card').forEach(b=>b.classList.toggle('selected',b.dataset.difficulty===difficulty));switchPage('difficulty')}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>chooseDifficulty(b.dataset.mode)));
document.querySelectorAll('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{difficulty=b.dataset.difficulty;document.querySelectorAll('[data-difficulty]').forEach(x=>x.classList.toggle('selected',x===b))}));
$('launchGame').onclick=()=>{
  const pool=clampRange('gameRangeStart','gameRangeEnd');
  if(!pool.length)return toast('出題範囲を確認してね');
  if(selectedMode==='battle'){$('rangeStart').value=$('gameRangeStart').value;$('rangeEnd').value=$('gameRangeEnd').value;$('questionCount').value=$('gameQuestionCount').value;beginBattle()}
  else{$('typingStart').value=$('gameRangeStart').value;$('typingEnd').value=$('gameRangeEnd').value;$('typingCount').value=$('gameQuestionCount').value;startTypingGame()}
};

// --- ① ランキング（スプレッドシートのランキングタブから取得） ---
async function loadRanking(){
  const box=$('rankingRows'),status=$('rankingStatus');
  if(!box||!status)return;
  status.textContent='スプレッドシートのランキングタブから取得中…';
  box.innerHTML='<tr><td colspan="6">読み込み中…</td></tr>';
  try{
    const res=await api('leaderboard',{limit:100});
    box.innerHTML='';
    if(!res.ranking?.length){
      box.innerHTML='<tr><td colspan="6">まだランキングデータがありません。</td></tr>';
      status.textContent='最初のクエストに挑戦してランキングに参加しよう。';
      return;
    }
    res.ranking.forEach((r,i)=>{
      const tr=document.createElement('tr');
      if(user&&r.userId===user.userId)tr.className='my-rank';
      [String(i+1).padStart(2,'0'),r.displayName||'冒険者',`LV ${r.level||1}`,Number(r.exp||0).toLocaleString(),Number(r.masteredCount||0).toLocaleString(),`${r.accuracy||0}%`].forEach((v,j)=>{
        const td=document.createElement('td');td.textContent=v;
        if(j===0&&i<3)td.className='rank-medal rank-'+(i+1);
        tr.appendChild(td)
      });
      box.appendChild(tr)
    });
    status.textContent=`${res.ranking.length}人の冒険者 · スプレッドシート（Leaderboardタブ）から取得`;
  }catch(e){
    status.textContent='ランキングを取得できません。Apps ScriptのURLやデプロイ設定を確認してね。';
    box.innerHTML='<tr><td colspan="6">'+e.message+'</td></tr>';
  }
}
$('refreshRanking').onclick=loadRanking;


// --- API & 認証 ---
function apiReady(){if(!API_URL){toast('先にGoogle Apps ScriptのURLを設定してください。READMEを確認してね。');return false}return true}
function api(action,payload={}){
  return new Promise((resolve,reject)=>{
    if(!API_URL)return reject(new Error('Google Apps ScriptのURLが未設定です'));
    const cb='__leap_cb_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');
    const timer=setTimeout(()=>{cleanup();reject(new Error('通信がタイムアウトしました。API URLと公開設定を確認してください。'))},15000);
    function cleanup(){clearTimeout(timer);delete window[cb];script.remove()}
    window[cb]=(res)=>{cleanup();if(res&&res.ok)resolve(res);else reject(new Error(res?.error||'処理に失敗しました'))};
    script.onerror=()=>{cleanup();reject(new Error('Google Apps Scriptに接続できません。WebアプリのURLを確認してください。'))};
    const params=new URLSearchParams({action,callback:cb,payload:JSON.stringify(payload),_:String(Date.now())});
    script.src=API_URL+(API_URL.includes('?')?'&':'?')+params.toString();
    document.body.appendChild(script)
  })
}
async function pinHash(id,pin){const bytes=new TextEncoder().encode('LEAP-QUEST|'+id+'|'+pin);const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function sessionSave(data){user={userId:data.userId,token:data.token};profile=data.profile;local.exp=Math.max(local.exp||0,profile.exp||0);local.answered=Math.max(local.answered||0,profile.answered||0);local.correct=Math.max(local.correct||0,profile.correct||0);localStorage.setItem('leap-quest-session',JSON.stringify(user));localStorage.setItem('leap-quest-local',JSON.stringify(local));$('authPanel').classList.add('hidden');$('profilePanel').classList.remove('hidden');$('miniOnline').textContent='● 接続中';$('miniOnline').className='status online';renderProfile();updateStats()}
function clearSession(){user=null;profile=null;localStorage.removeItem('leap-quest-session');$('authPanel').classList.remove('hidden');$('profilePanel').classList.add('hidden');$('miniName').textContent='ゲスト冒険者';$('miniId').textContent='ログインしてください';$('miniAvatar').src=defaultAvatar;$('miniOnline').textContent='● 未ログイン';$('miniOnline').className='status';$('accountState').textContent='GUEST MODE';updateStats()}

$('signupBtn').onclick=async()=>{
  const name=$('signupName').value.trim(),pin=$('signupPin').value,pin2=$('signupPinConfirm').value;
  if(!apiReady())return;
  if(!name){toast('冒険者名を入力してください');return}
  if(!/^\d{4}$/.test(pin)){toast('PINは数字4桁で入力してください');return}
  if(pin!==pin2){toast('PINが一致しません');return}
  try{
    $('signupBtn').disabled=true;
    const reserved=await api('reserveId',{});
    const res=await api('register',{userId:reserved.userId,displayName:name,pinHash:await pinHash(reserved.userId,pin)});
    sessionSave(res);toast('登録完了！ USER ID: '+res.userId+' ／ PINを忘れないでね');
    $('signupPin').value='';$('signupPinConfirm').value='';
  }catch(e){toast(e.message)}finally{$('signupBtn').disabled=false}
};

$('loginBtn').onclick=async()=>{
  if(!apiReady())return;
  const id=$('loginId').value.trim(),pin=$('loginPin').value;
  if(!/^\d{6}$/.test(id)\vert{}\vert{}!/^\d{4}$/.test(pin)){toast('6桁IDと4桁PINを入力してください');return}
  try{
    $('loginBtn').disabled=true;
    const res=await api('login',{userId:id,pinHash:await pinHash(id,pin)});
    sessionSave(res);toast('ログインしました');$('loginPin').value='';
  }catch(e){toast(e.message)}finally{$('loginBtn').disabled=false}
};

$('logoutBtn').onclick=async()=>{try{if(user)await api('logout',{token:user.token});clearSession();toast('ログアウトしました')}catch(e){clearSession();toast('ログアウトしました')}};
function renderProfile(){if(!user||!profile)return;$('profileName').textContent=profile.displayName||'冒険者';$('profileId').textContent=profile.userId\vert{}\vert{}user.userId\vert{}\vert{}'------';$('profileEmail').textContent='Googleスプレッドシート管理 · PINログイン';$('editName').value=profile.displayName\vert{}\vert{}'';$('profileAvatar').src=profile.photoURL||defaultAvatar;$('miniAvatar').src=profile.photoURL\vert{}\vert{}defaultAvatar;$('miniName').textContent=profile.displayName||'冒険者';$('miniId').textContent='ID '+(profile.userId\vert{}\vert{}user.userId\vert{}\vert{}'------');$('accountState').textContent='ACCOUNT READY';updateStats()}

$('saveProfile').onclick=async()=>{
  if(!user)return;let name=$('editName').value.trim();
  if(!name){toast('アカウント名を入力してください');return}
  try{let res=await api('updateProfile',{token:user.token,displayName:name});profile={...profile,...res.profile};renderProfile();toast('プロフィールを保存しました')}catch(e){toast(e.message)}
};
$('copyId').onclick=async()=>{try{await navigator.clipboard.writeText(profile?.userId||user?.userId||'');toast('ユーザーIDをコピーしました')}catch{toast('ID: '+(profile?.userId||user?.userId||''))}};
$('avatarFile').onchange=async ev=>{let file=ev.target.files?.[0];if(!file||!user)return;if(!file.type.startsWith('image/')){toast('画像ファイルを選んでください');return}if(file.size>200*1024){toast('画像は200KB以下にしてください');return}toast('画像アップロードはスプレッドシートAPIのURL制限のため既定アイコンを使用します。')};

async function syncProgress(){
  if(!user||!profile)return;
  const data={token:user.token,exp:local.exp||0,level:Math.floor((local.exp||0)/100)+1,masteredCount:(local.mastered||[]).length,answered:local.answered||0,correct:local.correct||0,accuracy:local.answered?Math.round(local.correct/local.answered*100):0,lastLog:local.lastLog||''};
  try{const res=await api('saveProgress',data);if(res.profile)profile={...profile,...res.profile}}catch(e){console.warn('Progress sync:',e.message)}
}

$('loginId').addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,6));
for(const id of ['signupPin','signupPinConfirm','loginPin'])$(id).addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,4));

async function restoreSession(){try{const saved=JSON.parse(localStorage.getItem('leap-quest-session')||'null');if(!saved?.token)return;user=saved;const res=await api('me',{token:user.token});sessionSave(res)}catch(e){clearSession()}}
if(!localStorage.getItem('leap-quest-session'))clearSession();else{$('authPanel').classList.add('hidden');$('profilePanel').classList.remove('hidden');}
restoreSession().finally(()=>{updateStats();if(!$('miniAvatar').src)$('miniAvatar').src=defaultAvatar});
