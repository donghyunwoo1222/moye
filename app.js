// Supabase 연결: 첫 번째는 Project URL(이미 넣음), 두 번째는 Publishable(anon) key로 교체하세요
const sb = supabase.createClient('https://nsuvvjfkmijcmkvvmdyd.supabase.co', 'nsuvvjfkmijcmkvvmdyd');
// 저장 중인 요청 개수 (0보다 크면 자동 새로고침이 화면을 덮어쓰지 않게 막음)
let saving = 0;
// 주소의 # 뒤에 있는 모임 ID를 꺼내는 함수 (예: ...app/#a1b2c3d4 → 'a1b2c3d4')
const eventId = () => decodeURIComponent(location.hash.slice(1));
// 참여자 아바타 배경색 목록
const COLORS = ['#e7f0e9','#f1ebe1','#e9edf5','#f4e9e8','#eeeafa','#e8f0f1'];
// 서버에서 불러오기 전에 잠깐 쓰는 기본 모임 정보 (날짜 범위만 사용)
const seed = {event:{id:'',name:'모임',start:'2026-11-20',end:'2026-12-05',finalDate:''}};
// 화면에 보여줄 현재 데이터 (처음엔 비어 있다가 서버에서 채워짐)
let state = { event: { ...seed.event }, participants: [] };
// 달력이 보여주는 달
let view = new Date(`${state.event.start}T12:00:00`);
// 지금 입력한 내 이름
let selectedName = '';
// 아래 상세 영역에 보여줄 선택된 날짜
let selectedDate = '2026-11-25';
// 토스트 숨김 타이머
let toastTimer;
// 참여자 '더보기' 펼침 여부
let showAllPeople = false;

// 서버에서 모임 + 참여자를 불러오는 함수 (성공하면 true)
async function loadRemote(){
  const id = eventId(); // 주소에서 모임 ID 읽기
  if(!id) return false; // ID가 없으면 불러올 모임이 없음
  const { data: ev, error } = await sb.from('events').select('*').eq('id', id).maybeSingle(); // 모임 1건 조회
  if(error || !ev) return false; // 오류이거나 없는 모임이면 실패
  const { data: ps } = await sb.from('participants').select('name,dates').eq('event_id', id).order('created_at'); // 참여자 조회 (참여 순서대로)
  if(saving > 0) return false; // 불러오는 사이 내가 저장을 시작했다면 덮어쓰지 않음
  state = { event: { id: ev.id, name: ev.name, start: ev.start_date, end: ev.end_date, finalDate: ev.final_date || '' }, participants: ps || [] }; // DB 컬럼명을 앱 이름으로 변환
  return true; // 성공
}
// 참여자 1명의 가능 날짜를 저장 (없으면 새로 만들고, 있으면 덮어씀)
async function saveParticipant(person){
  saving++; // 저장 시작
  const { error } = await sb.from('participants').upsert({ event_id: state.event.id, name: person.name, dates: person.dates }, { onConflict: 'event_id,name' }); // 같은 모임+같은 이름이면 업데이트
  saving--; // 저장 끝
  if(error) showToast('저장에 실패했어요. 다시 시도해 주세요.'); // 실패 알림
}
// 확정 날짜를 서버에 저장
async function saveFinal(){
  saving++; // 저장 시작
  const { error } = await sb.from('events').update({ final_date: state.event.finalDate || null }).eq('id', state.event.id); // 해당 모임의 final_date만 변경
  saving--; // 저장 끝
  if(error) showToast('확정 저장에 실패했어요.'); // 실패 알림
}

// Date 객체를 'YYYY-MM-DD' 문자열로 바꿈
function dateKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
// 'YYYY-MM-DD' 문자열을 Date 객체로 바꿈
function parseDate(key){return new Date(`${key}T12:00:00`);}
// 날짜를 한국어 형식으로 보기 좋게 바꿈
function formatDate(key,options={month:'long',day:'numeric',weekday:'short'}){return new Intl.DateTimeFormat('ko-KR',options).format(parseDate(key));}
// 모임 기간 안의 날짜인지 확인
function inRange(key){return key>=state.event.start&&key<=state.event.end;}
// 날짜를 1개 이상 고른 참여자만 반환
function peopleDone(){return state.participants.filter(person=>person.dates.length>0);}
// 특정 날짜에 가능한 사람 수
function dateCount(key){return peopleDone().filter(person=>person.dates.includes(key)).length;}
// 모임 시작일~종료일의 모든 날짜 목록
function dateKeys(){const start=parseDate(state.event.start),end=parseDate(state.event.end),days=[];for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1))days.push(dateKey(d));return days;}
// 추천 날짜 계산 (모두 가능한 날 우선, 없으면 가장 많이 가능한 날)
function recommendations(){const keys=dateKeys(),done=peopleDone();if(!done.length)return [];const counts=keys.map(key=>({key,count:dateCount(key)})),max=Math.max(...counts.map(item=>item.count));if(!max)return [];const full=done.length===state.participants.length?counts.filter(item=>item.count===state.participants.length):[];return full.length?full:counts.filter(item=>item.count===max);}
// 화면 전체를 다시 그림
function render(){renderEvent();renderCalendar();renderDateDetail();renderPeople();renderSummary();renderNameSelect();}
// 모임 제목, 기간, 참여 인원, 초대 링크를 그림
function renderEvent(){const {event}=state,range=`${formatDate(event.start,{year:'numeric',month:'long',day:'numeric'})} — ${formatDate(event.end,{month:'long',day:'numeric'})}`;document.title=`${event.name} — 모여`;document.querySelector('#event-name').textContent=event.name;document.querySelector('#event-range').textContent=range;document.querySelector('#menu-event-name').textContent=event.name;document.querySelector('#menu-event-range').textContent=range;document.querySelector('#participant-count').textContent=`${state.participants.length}명`;document.querySelector('#people-total').textContent=`${state.participants.length}명`;document.querySelector('#share-url').textContent=`${location.href.split("#")[0]}#${encodeURIComponent(event.id)}`;}
// 달력을 그림
function renderCalendar(){const grid=document.querySelector('#calendar-grid'),year=view.getFullYear(),month=view.getMonth(),first=new Date(year,month,1,12),offset=first.getDay(),days=new Date(year,month+1,0).getDate();document.querySelector('#month-label').textContent=new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long'}).format(first);grid.innerHTML='';['일','월','화','수','목','금','토'].forEach(day=>{const el=document.createElement('div');el.className='weekday';el.setAttribute('role','columnheader');el.textContent=day;grid.append(el);});const rowCount=Math.ceil((offset+days)/7);for(let index=0;index<rowCount*7;index++){const dayNumber=index-offset+1,date=new Date(year,month,dayNumber,12),key=dateKey(date),inside=dayNumber>0&&dayNumber<=days,participant=state.participants.find(person=>person.name===selectedName),available=participant?.dates.includes(key),recommended=recommendations().some(item=>item.key===key),count=dateCount(key),button=document.createElement('button');button.type='button';button.className=`calendar-day${inside?'':' outside'}${index%7===0?' sunday':''}${index%7===6?' saturday':''}${available?' my-available':''}${recommended?' recommended':''}${key===selectedDate?' selected-date':''}${inside&&!inRange(key)?' out-of-range':''}`;button.setAttribute('role','gridcell');button.setAttribute('aria-label',`${formatDate(key,{year:'numeric',month:'long',day:'numeric',weekday:'long'})}${available?' 내 가능 날짜':''}, 가능 ${count}명${recommended?', 추천 날짜':''}`);button.setAttribute('aria-pressed',String(!!available));button.disabled=!inside||!inRange(key)||!selectedName;button.innerHTML=`<span class="day-number">${inside?dayNumber:''}</span>${inside&&inRange(key)?`<span class="count"><b>${count}명</b></span>`:''}`;button.addEventListener('click',()=>toggleDate(key));grid.append(button);}}
// 선택한 날짜에 가능한 사람 목록을 그림
function renderDateDetail(){const detail=document.querySelector('#date-detail');if(!inRange(selectedDate))selectedDate=state.event.start;const people=state.participants.filter(person=>person.dates.includes(selectedDate));detail.innerHTML=`<div><strong>${formatDate(selectedDate,{month:'long',day:'numeric',weekday:'short'})}</strong><span>${people.length}명 가능</span></div><p>${people.length?people.map(person=>`<span>${escapeHtml(person.name)}</span>`).join(''):'아직 가능한 사람이 없어요.'}</p>`;}
// 참여자 목록을 그림
function renderPeople(){const list=document.querySelector('#people-list'),button=document.querySelector('#show-more');list.innerHTML='';const shown=showAllPeople?state.participants:state.participants.slice(0,4);shown.forEach((person,index)=>{const row=document.createElement('div');row.className=`person-row${person.name===selectedName?' active':''}`;const response=person.dates.length?'응답 완료':'미참여',dateText=person.dates.length?person.dates.map(date=>`${Number(date.slice(5,7))}/${Number(date.slice(8))}`).join(' · '):'미응답';row.innerHTML=`<span class="avatar" style="background:${COLORS[index%COLORS.length]};color:#4a6350">${escapeHtml(person.name.slice(0,1))}</span><span class="person-info"><span class="person-name">${escapeHtml(person.name)}</span><span class="person-response">${response}</span></span><span class="person-dates">${dateText}</span><button class="person-edit" type="button" aria-label="${escapeHtml(person.name)} 일정 선택">선택</button>`;row.querySelector('button').addEventListener('click',()=>{selectedName=person.name;render();});list.append(row);});button.hidden=state.participants.length<=4;button.textContent=showAllPeople?'접기':'더보기';button.setAttribute('aria-expanded',String(showAllPeople));}
// 추천 날짜 카드를 그림 (확정 버튼은 화면 갱신 후 서버에 저장)
function renderSummary(){const recs=recommendations(),list=document.querySelector('#recommend-list'),final=document.querySelector('#final-date');final.textContent=state.event.finalDate?`최종 일정 · ${formatDate(state.event.finalDate,{year:'numeric',month:'long',day:'numeric',weekday:'short'})}`:'최종 일정 미정';list.innerHTML='';if(!recs.length){list.innerHTML='<div class="recommend-empty">추천 날짜 없음</div>';return;}recs.forEach(item=>{const el=document.createElement('div');el.className=`recommend-item best${state.event.finalDate===item.key?' confirmed':''}`;el.innerHTML=`<span class="recommend-date">${formatDate(item.key,{month:'long',day:'numeric',weekday:'short'})}<small>${item.count}명 가능</small></span><button type="button" class="finalize-button" ${state.event.finalDate===item.key?'disabled':''}>${state.event.finalDate===item.key?'확정':'확정하기'}</button>`;el.querySelector('button').addEventListener('click',()=>{state.event.finalDate=item.key;renderSummary();saveFinal();});list.append(el);});}
// 이름 입력창의 자동완성 목록을 그림
function renderNameSelect(){const input=document.querySelector('#my-name'),options=document.querySelector('#participant-options');options.innerHTML='';state.participants.forEach(person=>{const option=document.createElement('option');option.value=person.name;options.append(option);});input.value=selectedName;}
// 날짜를 누르면 내 가능 날짜를 켜고 끄고, 서버에 저장
function toggleDate(key){if(!selectedName||!inRange(key))return;let person=state.participants.find(item=>item.name===selectedName);if(!person){person={name:selectedName,dates:[]};state.participants.push(person);}selectedDate=key;person.dates=person.dates.includes(key)?person.dates.filter(date=>date!==key):[...person.dates,key].sort();render();saveParticipant(person);}
// HTML 특수문자를 안전하게 바꿈
function escapeHtml(text){return text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
// 아래쪽에 잠깐 뜨는 안내 메시지
function showToast(message){const toast=document.querySelector('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2200);}
// 초대 링크를 클립보드에 복사
async function copyInvite(){const text=document.querySelector('#share-url').textContent;try{await navigator.clipboard.writeText(text);}catch{const input=document.createElement('textarea');input.value=text;document.body.append(input);input.select();document.execCommand('copy');input.remove();}showToast('초대 링크를 복사했어요.');}
// '모임 만들기' 팝업을 엽니다
function openDialog(){document.querySelector('#menu-dialog').close();const dialog=document.querySelector('#create-dialog'),start=document.querySelector('#start-date'),end=document.querySelector('#end-date');start.value=state.event.start;end.value=state.event.end;document.querySelector('#new-name').value='';document.querySelector('#form-error').textContent='';dialog.showModal();}

// 메뉴, 팝업, 복사, 이름 입력, 더보기, 달 이동 버튼 연결
document.querySelector('#open-menu').addEventListener('click',()=>document.querySelector('#menu-dialog').showModal());document.querySelector('#close-menu').addEventListener('click',()=>document.querySelector('#menu-dialog').close());document.querySelector('#new-event').addEventListener('click',openDialog);document.querySelector('#close-dialog').addEventListener('click',()=>document.querySelector('#create-dialog').close());document.querySelector('#copy-button').addEventListener('click',copyInvite);document.querySelector('#my-name').addEventListener('input',event=>{selectedName=event.target.value.trim();renderCalendar();renderDateDetail();renderPeople();});document.querySelector('#show-more').addEventListener('click',()=>{showAllPeople=!showAllPeople;renderPeople();});document.querySelector('#prev-month').addEventListener('click',()=>{view.setDate(1);view.setMonth(view.getMonth()-1);renderCalendar();});document.querySelector('#next-month').addEventListener('click',()=>{view.setDate(1);view.setMonth(view.getMonth()+1);renderCalendar();});

// 모임 만들기 제출: 서버에 저장한 뒤 주소에 모임 ID를 붙임
document.querySelector('#create-form').addEventListener('submit', async event => { // async: 서버 저장을 기다려야 해서
  event.preventDefault(); // 폼 기본 새로고침 막기
  const form = new FormData(event.currentTarget); // 입력값 읽기
  const name = String(form.get('name')).trim(); // 모임 이름
  const start = String(form.get('start')); // 시작일
  const end = String(form.get('end')); // 종료일
  const error = document.querySelector('#form-error'); // 오류 문구 칸
  if(!name){ error.textContent = '모임 이름을 입력해 주세요.'; return; } // 이름 검사
  if(!start || !end || start > end){ error.textContent = '종료일은 시작일과 같거나 이후여야 해요.'; return; } // 날짜 검사
  const id = crypto.randomUUID().slice(0, 8); // 짧은 고유 ID 만들기 (링크가 너무 길지 않게)
  const { error: dbError } = await sb.from('events').insert({ id, name, start_date: start, end_date: end }); // 서버에 모임 저장
  if(dbError){ error.textContent = '모임 저장에 실패했어요. 다시 시도해 주세요.'; return; } // 실패 시 중단
  state = { event: { id, name, start, end, finalDate: '' }, participants: [] }; // 화면용 상태 갱신
  selectedName = ''; selectedDate = start; showAllPeople = false; // 선택 상태 초기화
  view = parseDate(start); // 달력을 시작월로 이동
  history.replaceState(null, '', '#' + id); // 주소에 모임 ID 붙이기 → 이게 초대 링크가 됨
  render(); // 화면 갱신
  document.querySelector('#create-dialog').close(); // 팝업 닫기
  showToast('모임을 만들었어요.'); // 안내 토스트
});

// 앱 시작: 주소의 모임 ID로 서버에서 불러오기
async function init(){
  const ok = await loadRemote(); // 서버에서 불러오기 시도
  if(ok){ // 모임을 찾았으면
    view = parseDate(state.event.start); // 달력을 모임 시작월로
    selectedDate = state.event.start; // 선택 날짜도 시작일로
    render(); // 화면 그리기
  } else { // 못 찾았으면
    render(); // 일단 빈 화면 그리기
    if(eventId()) showToast('모임을 찾지 못했어요. 새로 만들어 주세요.'); // 링크는 있는데 모임이 없는 경우 안내
    openDialog(); // 모임 만들기 팝업 열기
  }
}
init(); // 실행

// 10초마다 다른 친구의 변경사항을 가져와 화면 갱신
setInterval(async () => {
  if(!eventId() || saving > 0) return; // 모임이 없거나 저장 중이면 건너뜀
  if(await loadRemote()) render(); // 불러오기 성공하면 다시 그림
}, 10000);