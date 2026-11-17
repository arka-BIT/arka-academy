/* Arka portal v2 — student home (exam countdown + enrolled batches), batch pages
   (daily tasks, responsibility map, improvement graph, pending & backlogs),
   a responsibility map per batch type, and mentor stars out of 10.
   Load this AFTER the main script in portal.html:
   <script src="portal-multibatch.js"></script>  (just before </body>) */

var SB={},MYB=[],SV={bid:null,tab:"tasks"},MT=null;
function bname(b){return(BATCHES[b]||{}).name||"Batch"}
function bset(p){var a=[];if(p.batch_id)a.push(String(p.batch_id));(SB[p.id]||[]).forEach(function(b){if(a.indexOf(b)<0)a.push(b)});return a}
function topicsOf(p){var bs=bset(p);return TOPICS.filter(function(t){return bs.indexOf(String(t.batch_id))>-1})}

/* ================= responsibility maps (chosen per batch in admin) =================
   w: T = teacher ticks it for the batch, S = student, M = mentor
   f: the field that records it · after: the step that must be done first
   from/hrs: when the mentor's clock starts and the batch deadline (hours) */
var MAPS={
foundation:{name:"Foundation",steps:[
 {k:"class",l:"Class delivered",w:"T",f:"class_done"},
 {k:"notes",l:"Notes shared",w:"T",f:"notes_done"},
 {k:"understood",l:"Understood the topic",w:"S",f:"understood_at",after:"class",btn:"I have understood this topic",todo:"Mark that you have understood the topic"},
 {k:"oral",l:"Oral test call",w:"M",f:"oral_at",from:"understood_at",hrs:"oral_hours",todo:"Oral test call"},
 {k:"mcq",l:"MCQ test attempted",w:"S",f:"mcq_at",after:"understood",todo:"Attempt the MCQ test"},
 {k:"answer",l:"Answers submitted",w:"S",f:"answer_at",upload:1},
 {k:"eval",l:"Evaluated",w:"M",f:"eval_at",from:"answer_at",hrs:"eval_hours",todo:"Evaluate the copy"},
 {k:"improve",l:"Improvement call",w:"M",f:"improve_at",from:"eval_at",hrs:"improve_hours",todo:"Improvement call"}]},
mains:{name:"Mains answer writing",steps:[
 {k:"notes",l:"Notes shared",w:"T",f:"notes_done"},
 {k:"understood",l:"Developed understanding of the topic",w:"S",f:"understood_at",btn:"I have understood this topic",todo:"Study the notes and mark that you have understood the topic"},
 {k:"answer",l:"Submitted the daily task",w:"S",f:"answer_at",upload:1},
 {k:"eval",l:"Evaluated copy received",w:"M",f:"eval_at",from:"answer_at",hrs:"eval_hours",todo:"Evaluate the copy"},
 {k:"improve",l:"Improvement call",w:"M",f:"improve_at",from:"eval_at",hrs:"improve_hours",todo:"Improvement call"},
 {k:"revision",l:"Revised the topic",w:"S",f:"revised_at",after:"eval",btn:"I have revised this topic",todo:"Revise the topic using your mentor’s feedback"}]},
essay:{name:"Essay",steps:[
 {k:"brainstorm",l:"Brainstorming done",w:"S",f:"understood_at",btn:"I have done the brainstorming",todo:"Brainstorm the essay topic"},
 {k:"written",l:"Essay written",w:"S",f:"written_at",after:"brainstorm",btn:"I have written the essay",todo:"Write the essay"},
 {k:"answer",l:"Essay submitted",w:"S",f:"answer_at",upload:1},
 {k:"eval",l:"Evaluated copy received",w:"M",f:"eval_at",from:"answer_at",hrs:"eval_hours",todo:"Evaluate the essay"},
 {k:"improve",l:"Improvement call",w:"M",f:"improve_at",from:"eval_at",hrs:"improve_hours",todo:"Improvement call"},
 {k:"content",l:"Content preparation on the essay",w:"M",f:"content_at",from:"improve_at",hrs:"improve_hours",todo:"Prepare and share essay content"},
 {k:"revision",l:"Revision done",w:"S",f:"revised_at",after:"content",btn:"I have revised this essay",todo:"Revise this essay"}]}};
MAPS.prelims=MAPS.foundation;
var WHO={T:"Teacher",S:"You",M:"Mentor"};
function mapOfB(bid){var b=BATCHES[bid]||{};return MAPS[b.map_type]||MAPS.foundation}
function mapOf(t){return mapOfB(t.batch_id)}
function isDone(s,t,p){return s.w==="T"?!!t[s.f]:!!(p&&p[s.f])}
function stepByK(m,k){return m.steps.filter(function(s){return s.k===k})[0]}
/* d = done, n = student's turn, w = waiting on mentor, o = mentor overdue, "" = not yet */
function stepState(t,p){p=p||{};var m=mapOf(t),b=BATCHES[t.batch_id]||{},now=Date.now();
return m.steps.map(function(s){if(isDone(s,t,p))return"d";if(s.w==="T")return"";
if(s.w==="M"){var st=p[s.from];if(!st)return"";return now>new Date(st).getTime()+(b[s.hrs]||48)*36e5?"o":"w"}
var a=s.after&&stepByK(m,s.after);return(!a||isDone(a,t,p))?"n":""})}
/* when a student uploads, tick the earlier student steps they skipped (not the MCQ) */
function preFields(t,p){var m=mapOf(t),f={},now=new Date().toISOString();for(var i=0;i<m.steps.length;i++){var s=m.steps[i];if(s.upload)break;if(s.w==="S"&&s.k!=="mcq"&&!isDone(s,t,p))f[s.f]=now}return f}
/* a student may undo a step only while no later step of theirs or the mentor's is done */
function canUndo(t,p,i){var m=mapOf(t);for(var j=i+1;j<m.steps.length;j++){var s=m.steps[j];if(s.w!=="T"&&isDone(s,t,p))return false}return true}
/* keep the old name working for anything that still calls it */
state=function(t,p){return stepState(t,p)};
function dots(st){return'<span class="dots" aria-label="'+st.filter(function(x){return x==="d"}).length+' of '+st.length+' steps done">'+st.map(function(x){return'<i class="dot '+(x?'s'+x:'')+'"></i>'}).join("")+'</span>'}
function dayLabel(t){var m=String(t.title||"").match(/^(day|essay)\s*(\d+)\s*(?:[–—-]\s*)?(.*)$/i);return m?{d:(/^essay/i.test(m[1])?"Essay ":"Day ")+m[2],topic:m[3]}:{d:"",topic:t.title||""}}
function todayISO(){var d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)}
function longD(v){if(!v)return"";var d=new Date(v+"T00:00:00");return d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}

/* ================= Madhubani touches (inline SVG) ================= */
var FISH='<svg class="mb-fish" viewBox="0 0 70 34" aria-hidden="true"><path d="M5 17C15 4 39 4 50 17 39 30 15 30 5 17Z" fill="#FFF6E5" stroke="#1d140a" stroke-width="2"/><path d="M50 17 63 6v22Z" fill="#D91E2E" stroke="#1d140a" stroke-width="2"/><circle cx="15" cy="15" r="2.6" fill="#1d140a"/><path d="M23 9v16M29 8v18M35 9v16M41 11v12" stroke="#0E7C7B" stroke-width="2.2" stroke-linecap="round"/><path d="M8 17h3" stroke="#E3A008" stroke-width="2"/></svg>';
var LOTUS='<div class="mb-lotus" aria-hidden="true"><svg viewBox="0 0 60 26"><path d="M30 3c6 6 6 14 0 20-6-6-6-14 0-20Z" fill="#D91E2E" stroke="#1d140a" stroke-width="1.6"/><path d="M30 23C22 21 15 15 13 8c7 1 14 7 17 15Zm0 0c8-2 15-8 17-15-7 1-14 7-17 15Z" fill="#E3A008" stroke="#1d140a" stroke-width="1.6"/><path d="M30 23c-10 2-19-1-25-7 9-2 18 1 25 7Zm0 0c10 2 19-1 25-7-9-2-18 1-25 7Z" fill="#0E7C7B" stroke="#1d140a" stroke-width="1.6"/></svg></div>';

/* ================= exam countdown + motivation ================= */
var MOTIVE=["Don’t count the days — make every day count.","One topic, one answer, one improvement — every single day.","Every answer you write today is a mark you earn in the exam hall.","Discipline today, confidence on exam day.","Small steps every day build the officer you are becoming.","Consistency beats intensity. Show up today, and again tomorrow.","The syllabus is long, but your resolve is longer. Keep going.","Your future self is counting on today’s hour of practice.","Progress, not perfection. Write today’s answer.","You can do this — one day, one answer, one step at a time."];
function daysTo(iso){var t=new Date(iso+"T00:00:00"),n=new Date();n.setHours(0,0,0,0);return Math.round((t-n)/864e5)}
function countdown(){var E=window.ARKA_EXAMS||{prelims:"2027-05-23",mains:"2027-08-20",year:2027},dp=daysTo(E.prelims),dm=daysTo(E.mains);
var doy=Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0))/864e5),line=MOTIVE[doy%MOTIVE.length];
function tile(n,label,date){return n>=0?'<div class="cd"><b>'+n+'</b><span>'+(n===1?"day":"days")+' to <strong>'+label+'</strong></span><small>'+longD(date)+'</small></div>':'<div class="cd done"><b>✓</b><span><strong>'+label+'</strong> is behind you</span><small>On to the next stage</small></div>'}
return'<div class="mb-hero"><div class="mb-band"></div><div class="mb-in">'+FISH+'<h1>Hello, '+esc(ME.full_name.split(" ")[0])+'</h1>'
+'<div class="cds">'+tile(dp,"Prelims "+(E.year||""),E.prelims)+tile(dm,"Mains "+(E.year||""),E.mains)+'</div>'
+'<p class="motive">“'+esc(line)+'”</p></div><div class="mb-band"></div></div>'}

/* ================= student ================= */
if(location.hash==="#premium")VIEW="lib";
function studentHome(){if(typeof PVIEW!=="undefined"&&PVIEW==="lib")return premiumPage();Promise.all([
db.from("batches").select("*"),
db.from("topics").select("*").order("sort_order").order("id"),
db.from("progress").select("*").eq("student_id",ME.id),
db.rpc("my_mentor"),
db.from("student_batches").select("*").eq("student_id",ME.id)])
.then(function(r){
BATCHES={};(r[0].data||[]).forEach(function(b){BATCHES[b.id]=b});
SB={};SB[ME.id]=(r[4].data||[]).map(function(x){return String(x.batch_id)});
MYB=bset(ME);
TOPICS=(r[1].data||[]).filter(function(t){return MYB.indexOf(String(t.batch_id))>-1});
PROG={};(r[2].data||[]).forEach(function(p){PROG[p.topic_id]=p});MT=(r[3].data||[])[0]||null;
readHash();renderStudent()})}
function readHash(){var m=location.hash.match(/^#b-(\d+)(?:-(\w+))?$/);SV.bid=m&&MYB.indexOf(m[1])>-1?m[1]:null;SV.tab=m&&m[2]||"tasks"}
function go(h){if(location.hash===h)renderStudent();else location.hash=h}
window.addEventListener("hashchange",function(){if(!ME||ME.role!=="student")return;if(location.hash==="#premium"){PVIEW="lib";return studentHome()}
if(PVIEW==="lib"){PVIEW="map";return studentHome()}readHash();renderStudent()});

function bStats(bid){var ts=TOPICS.filter(function(t){return String(t.batch_id)===String(bid)}),all=0,done=0,mine=[],back=[],wait=0,today=todayISO();
ts.forEach(function(t){var p=PROG[t.id],st=stepState(t,p),m=mapOf(t);all+=st.length;st.forEach(function(x,i){if(x==="d")done++;if(x==="w"||x==="o")wait++;
if(x==="n"){var item=[t,m.steps[i]];(t.class_date&&t.class_date<today?back:mine).push(item)}})});
return{ts:ts,pc:all?Math.round(done/all*100):0,pending:mine,backlog:back,wait:wait}}

function renderStudent(){var h=(typeof pvTabs==="function"?pvTabs():"");
if(!SV.bid){h+=countdown();
h+='<div class="card mb-card"><h2>Your batches</h2><p class="lead">You are currently enrolled in '+(MYB.length===1?"this batch":"these batches")+'. Open one to see your daily tasks, progress and graph.</p>';
if(!MYB.length)h+='<p style="color:var(--mu)">Arka Academy will add you to your batch soon.</p>';
h+='<div class="bgrid">'+MYB.map(function(bid){var b=BATCHES[bid]||{},s=bStats(bid);
return'<a class="bcard" href="#b-'+bid+'"><span class="bk">'+esc(mapOfB(bid).name)+'</span><b>'+esc(b.name||"Batch")+'</b>'
+(MT?'<small>Mentor: <strong>'+esc(MT.full_name)+'</strong>'+(MT.phone?' · '+esc(MT.phone):'')+'</small>':'')
+'<div class="bar"><i style="width:'+s.pc+'%"></i></div><span class="bmeta">'+s.pc+'% done · '+s.ts.length+' tasks · <em class="'+(s.pending.length?"hot":"")+'">'+s.pending.length+' pending</em>'+(s.backlog.length?' · <em class="bad">'+s.backlog.length+' backlog</em>':'')+'</span><span class="go">Open batch →</span></a>'}).join("")+'</div></div>';
H(h);if(typeof wirePV==="function")wirePV();return}
var bid=SV.bid,b=BATCHES[bid]||{},m=mapOfB(bid),s=bStats(bid);
h+='<p style="margin:0 0 10px"><a href="#" class="back" id="bkH">← All my batches</a></p>';
h+='<div class="mb-hero slim"><div class="mb-band"></div><div class="mb-in">'+FISH+'<h1>'+esc(b.name||"Batch")+'</h1><p class="sub">'+esc(m.name)+' map'+(MT?' · Mentor: <b>'+esc(MT.full_name)+'</b>'+(MT.phone?' ('+esc(MT.phone)+')':''):'')+'</p>'
+'<div class="stats"><div><b>'+s.pc+'%</b><span>steps complete</span></div><div><b>'+s.ts.length+'</b><span>tasks so far</span></div><div><b>'+s.pending.length+'</b><span>pending on you</span></div><div><b class="'+(s.backlog.length?"":"ok")+'">'+s.backlog.length+'</b><span>backlogs</span></div></div></div><div class="mb-band"></div></div>';
var TABS=[["tasks","Daily tasks"],["map","Responsibility map"],["graph","Improvement graph"],["pending","Pending & backlogs"+(s.pending.length+s.backlog.length?" ("+(s.pending.length+s.backlog.length)+")":"")]];
h+='<div class="tabs btabs">'+TABS.map(function(x){return'<button type="button" data-bt="'+x[0]+'" aria-pressed="'+(SV.tab===x[0])+'">'+x[1]+'</button>'}).join("")+'</div>';
if(SV.tab==="tasks")h+=tasksView(s.ts);
if(SV.tab==="map")h+=mapView(s.ts,m);
if(SV.tab==="graph")h+='<div class="card mb-card"><h2>Your improvement graph</h2><p class="lead">Stars your mentor gives each evaluated copy, out of 10, from Day 1 onwards.</p>'+graph(s.ts.map(function(t){return[t,PROG[t.id]]}))+'</div>';
if(SV.tab==="pending")h+=pendingView(s);
H(h);if(typeof wirePV==="function")wirePV();
$("bkH").onclick=function(e){e.preventDefault();go("#")};
document.querySelectorAll("[data-bt]").forEach(function(x){x.onclick=function(){go("#b-"+bid+"-"+x.dataset.bt)}});
document.querySelectorAll("[data-t]").forEach(function(el){el.onclick=function(e){if(e.target.closest("a"))return;topicModal(+el.dataset.t)}});
var UPT=null;document.querySelectorAll("[data-up]").forEach(function(x){x.onclick=function(){UPT=+x.dataset.up;$("upF").value="";$("upF").click()}});
document.querySelectorAll("[data-va]").forEach(function(x){x.onclick=function(){var p=PROG[+x.dataset.va];if(p&&p.answer_path)openFile(p.answer_path)}});
document.querySelectorAll("[data-ve]").forEach(function(x){x.onclick=function(){var p=PROG[+x.dataset.ve];if(p&&p.eval_path)openFile(p.eval_path)}});
if($("upF"))$("upF").onchange=function(){var files=this.files,id=UPT,t=TOPICS.filter(function(x){return x.id===id})[0];if(!files.length||!t)return;
var dl=dayLabel(t),nm=t.subject+" › "+(dl.d||t.title);document.querySelectorAll("[data-up]").forEach(function(b){b.disabled=true});msg("tkMsg","Compressing and uploading your answer for "+nm+"…",true);$("tkMsg").scrollIntoView({block:"center"});
upCopy(ME.id,id,"answer",files).then(function(path){var f=preFields(t,PROG[id]||{});f.answer_path=path;f.answer_at=new Date().toISOString();f.student_id=ME.id;f.topic_id=id;
return db.from("progress").upsert(f).select().single()}).then(function(r){if(r.error)throw r.error;PROG[id]=r.data;renderStudent();msg("tkMsg","✓ Uploaded your answer for "+nm+". Your mentor will evaluate it.",true)})
.catch(function(e){document.querySelectorAll("[data-up]").forEach(function(b){b.disabled=false});msg("tkMsg",e.message)})}}

function chip(t){var p=PROG[t.id]||{},st=stepState(t,p);
if(st.every(function(x){return x==="d"}))return'<span class="chip ok">All done</span>';
if(p.eval_at)return'<span class="chip ok">Evaluated'+(p.stars!=null?' · ★ '+p.stars+'/10':'')+'</span>';
if(p.answer_at)return'<span class="chip w">Submitted · being evaluated</span>';
if(st.indexOf("n")>-1)return'<span class="chip n">Your turn</span>';return'<span class="chip">Not started</span>'}
function groupBySubject(ts){var subs=[];ts.forEach(function(t){if(subs.indexOf(t.subject)<0)subs.push(t.subject)});return subs}
function upBtn(t){var p=PROG[t.id]||{};if(p.eval_at)return'<button type="button" class="btn s" data-va="'+t.id+'">My answer</button>'+(p.eval_path?'<button type="button" class="btn s p" data-ve="'+t.id+'">Evaluated copy</button>':'');return p.answer_at?'<button type="button" class="btn s" data-va="'+t.id+'">View my answer</button><button type="button" class="btn s" data-up="'+t.id+'">Replace</button>':'<button type="button" class="btn s p" data-up="'+t.id+'">⬆ Upload your task</button>'}
function tasksView(ts){var h='<div class="card mb-card"><h2>Daily tasks</h2><p class="lead">Download the day’s questions, write your answer, then upload it here: one PDF, or photos of all pages together.</p><div id="tkMsg"></div><input type="file" id="upF" accept="application/pdf,image/*" multiple hidden>';
if(!ts.length)return h+'<p style="color:var(--mu)">Tasks will appear here as Arka Academy adds them.</p></div>';
groupBySubject(ts).forEach(function(sub,i){if(i)h+=LOTUS;h+='<p class="subj">'+esc(sub)+'</p>';
ts.filter(function(t){return t.subject===sub}).forEach(function(t){var dl=dayLabel(t);
h+='<div class="trow task"><span class="dno">'+esc(dl.d||"•")+'</span><span><b>'+esc(dl.topic||(dl.d?"":t.title))+'</b>'+(t.class_date?(dl.topic||!dl.d?'<br>':'')+'<small>Class: '+esc(longD(t.class_date))+'</small>':'')+'</span>'
+'<span class="tact">'+(t.task_url?'<a class="btn s pdf" href="'+esc(t.task_url)+'" target="_blank" rel="noopener">📄 Task PDF</a>':'<small class="muted">No PDF yet</small>')+chip(t)+upBtn(t)+'</span></div>'})});
return h+'</div>'}
function legend(){return'<div class="legend"><span><i style="background:#1e8449"></i>Done</span><span><i style="background:#fff;border:2px solid #0B4FA8"></i>Your turn</span><span><i style="background:#f2b705"></i>Waiting on mentor</span><span><i style="background:#D91E2E"></i>Mentor overdue</span><span><i style="background:#e4dccb"></i>Not yet</span></div>'}
function stepKey(m){return'<ol class="skey">'+m.steps.map(function(s){return'<li>'+esc(s.l)+' <em>'+WHO[s.w]+'</em></li>'}).join("")+'</ol>'}
function mapView(ts,m){var h='<div class="card mb-card"><h2>Your responsibility map</h2><p class="lead">Each dot is one step, in this order:</p>'+stepKey(m)+legend();
if(!ts.length)return h+'<p style="color:var(--mu)">Your map fills in as tasks are added.</p></div>';
groupBySubject(ts).forEach(function(sub){h+='<p class="subj">'+esc(sub)+'</p>';ts.filter(function(t){return t.subject===sub}).forEach(function(t){var dl=dayLabel(t);
h+='<div class="trow" data-t="'+t.id+'"><span><b>'+esc(dl.d?dl.d+(dl.topic?" – "+dl.topic:""):t.title)+'</b></span>'+dots(stepState(t,PROG[t.id]))+'<span class="btn s hide-m">Open</span></div>'})});
return h+'</div>'}
function pendingView(s){function list(items,empty,cls){if(!items.length)return'<p style="color:var(--mu)">'+empty+'</p>';
return'<ul class="queue">'+items.map(function(x){var dl=dayLabel(x[0]);return'<li><span class="tag'+(cls?" "+cls:"")+'">'+esc(x[0].subject)+'</span><span><b>'+esc(dl.d?dl.d+(dl.topic?" – "+dl.topic:""):x[0].title)+'</b><br><small>'+esc(x[1].upload?"Write and upload your answer":(x[1].todo||x[1].l))+(x[0].class_date?' · class '+esc(longD(x[0].class_date)):'')+'</small></span><button class="btn s" data-t="'+x[0].id+'">Open</button></li>'}).join("")+'</ul>'}
return'<div class="card mb-card"><h2>Backlogs</h2><p class="lead">Tasks whose class date has passed and still need your step. Clear these first.</p>'+list(s.backlog,"No backlogs. Well done — keep it that way.","bad")+'</div>'
+'<div class="card mb-card"><h2>Pending</h2><p class="lead">Your next steps on current tasks.</p>'+list(s.pending,"Nothing pending right now.")
+(s.wait?'<p class="pn-note">'+s.wait+' step'+(s.wait===1?' is':'s are')+' waiting on your mentor.</p>':'')+'</div>'}

/* ================= improvement graph (stars out of 10) ================= */
function graph(rows){var pts=rows.filter(function(r){return r[1]&&r[1].stars!=null});
if(!pts.length)return'<div class="gempty">'+FISH+'<p>Your graph starts after your first evaluated copy. Every star is a step forward.</p></div>';
var W=Math.max(820,pts.length*70),Hh=250,L=36,R=40,T=16,B=46,iw=W-L-R,ih=Hh-T-B,n=pts.length;
function x(i){return L+(n===1?iw/2:i*iw/(n-1))}function y(v){return T+ih-(v/10)*ih}
var g='<svg viewBox="0 0 '+W+' '+Hh+'" class="gsvg" role="img" aria-label="Stars out of 10 for each evaluated task">';
[0,2,4,6,8,10].forEach(function(v){g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="'+(v?"#efe4cf":"#c9b897")+'"/><text x="'+(L-8)+'" y="'+(y(v)+4)+'" text-anchor="end" class="gt">'+v+'</text>'});
var avg=pts.reduce(function(a,r){return a+r[1].stars},0)/n;g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(avg)+'" y2="'+y(avg)+'" stroke="#0E7C7B" stroke-dasharray="5 5"/>';
g+='<polyline fill="none" stroke="#082F6B" stroke-width="2.5" stroke-linejoin="round" points="'+pts.map(function(r,i){return x(i)+","+y(r[1].stars)}).join(" ")+'"/>';
pts.forEach(function(r,i){var dl=dayLabel(r[0]),lab=/^essay/i.test(r[0].subject||"")?(dl.d||r[0].title):(r[0].subject||"").replace(/GS Paper\s*/i,"GS").replace(/Prelims GS Paper\s*/i,"Pre GS")+" "+(dl.d||"").replace("Day ","D").replace("Essay ","E");
g+='<circle cx="'+x(i)+'" cy="'+y(r[1].stars)+'" r="5.5" fill="#D91E2E" stroke="#fff" stroke-width="2"><title>'+esc(r[0].subject+" › "+r[0].title+": "+r[1].stars+"/10")+'</title></circle>'
+'<text x="'+x(i)+'" y="'+(y(r[1].stars)-10)+'" text-anchor="middle" class="gv">'+r[1].stars+'</text><text x="'+x(i)+'" y="'+(Hh-B+18)+'" text-anchor="middle" class="gt">'+esc(lab.trim())+'</text>'});
g+='</svg>';var first=pts[0][1].stars,last=pts[n-1][1].stars,best=Math.max.apply(null,pts.map(function(r){return r[1].stars})),l5=pts.slice(-5),a5=l5.reduce(function(a,r){return a+r[1].stars},0)/l5.length;
return'<div class="gwrap">'+g+'</div><div class="gstats"><div><b>'+avg.toFixed(1)+'</b><span>average ★</span></div><div><b>'+a5.toFixed(1)+'</b><span>last '+l5.length+' average</span></div><div><b>'+best+'</b><span>best so far</span></div><div><b class="'+(last>=first?"":"down")+'">'+(last-first>=0?"+":"")+(last-first)+'</b><span>since your first</span></div></div><p class="pn-note">Dashed line: your average.</p>'}

/* ================= student task window ================= */
function topicModal(id){var t=TOPICS.filter(function(x){return x.id===id})[0];if(!t)return;var p=PROG[id]||{},m=mapOf(t),b=BATCHES[t.batch_id]||{},st=stepState(t,p),dl=dayLabel(t);
function due(from,hrs){return dueTxt(new Date(p[from]).getTime()+(b[hrs]||48)*36e5-Date.now())}
var info=m.steps.map(function(s,i){var x=st[i],prev=s.after&&stepByK(m,s.after);
if(s.w==="T"){if(s.k==="notes")return t.notes_done?(t.notes_url?'<a href="'+esc(t.notes_url)+'" target="_blank" rel="noopener">Open notes</a>':"Shared"):"Not yet";return x==="d"?"Done":"Not yet"}
if(s.upload)return(p.answer_at?'Submitted '+fmtT(p.answer_at)+' · <a href="#" id="vA">View</a><br>':'')+(true?'<span class="inl"><input id="aF" type="file" accept="application/pdf,image/*" multiple title="One PDF (max 5 MB), or photos of each page"><button class="btn s p" id="aA">'+(p.answer_at?"Replace":"Upload answer")+'</button></span><br><small style="color:#7a6a55">Select photos of all pages together (they are compressed and joined into one PDF), or one PDF under 5 MB.</small>':'After “'+esc(prev?prev.l:"")+'”');
if(s.w==="S"){if(x==="d")return"Marked "+fmtT(p[s.f])+(s.k==="mcq"&&p.mcq_score?" · Score "+esc(p.mcq_score):"")+(canUndo(t,p,i)?' · <a href="#" class="undo" data-undo="'+s.f+'">Undo</a>':"");
if(x!=="n")return'After “'+esc(prev?prev.l:"")+'”';
if(s.k==="mcq")return'<span class="inl"><input id="mS" placeholder="Your score, e.g. 14/20"><button class="btn s p" data-mk="mcq_at">Mark MCQ done</button></span>';
return'<button class="btn s p" data-mk="'+s.f+'">'+esc(s.btn||"Mark done")+'</button>'}
if(s.k==="oral")return p.oral_at?"Done "+fmtT(p.oral_at)+(p.oral_score?" · Score "+p.oral_score+"/5":"")+(p.oral_remarks?"<br>"+esc(p.oral_remarks):""):(p.understood_at?"Your mentor will call you ("+due("understood_at","oral_hours")+")":"After you mark “Understood”");
if(s.k==="eval")return p.eval_at?"Evaluated "+fmtT(p.eval_at)+(p.stars!=null?' · <b class="star">★ '+p.stars+'/10</b>':"")+(p.eval_marks?" · Marks "+esc(p.eval_marks):"")+(p.eval_path?' · <a href="#" id="vE">Evaluated copy</a>':"")+(p.eval_remarks?"<br>"+esc(p.eval_remarks):""):(p.answer_at?"Being evaluated ("+due("answer_at","eval_hours")+")":"After you submit");
if(s.k==="improve")return p.improve_at?"Done "+fmtT(p.improve_at)+(p.improve_notes?"<br>"+esc(p.improve_notes):""):(p.eval_at?"Your mentor will call you ("+due("eval_at","improve_hours")+")":"After evaluation");
if(s.k==="content")return p.content_at?"Shared by your mentor "+fmtT(p.content_at):(p.improve_at?"Your mentor is preparing the content ("+due("improve_at","improve_hours")+")":"After the improvement call");return""});
modal('<p class="subj" style="margin-top:0">'+esc(t.subject)+'</p><h2>'+esc(dl.d?dl.d+(dl.topic?" – "+dl.topic:""):t.title)+'</h2>'
+(t.task_url||t.recording_url?'<p class="inl">'+(t.task_url?'<a class="btn s p" href="'+esc(t.task_url)+'" target="_blank" rel="noopener">📄 Task questions (PDF)</a>':'')+(t.recording_url?'<a class="btn s" href="'+esc(t.recording_url)+'" target="_blank" rel="noopener">Class recording</a>':'')+'</p>':'')
+m.steps.map(function(s,i){return'<div class="step '+(st[i]&&st[i]!=="n"?"s"+st[i]:"")+'"><span class="n">'+(st[i]==="d"?"✓":i+1)+'</span><div><b>'+esc(s.l)+'</b><span class="who">'+WHO[s.w]+'</span><p>'+info[i]+'</p></div></div>'}).join("")+'<div id="mm"></div>');
function save(fields,btn){if(btn)btn.disabled=true;fields.student_id=ME.id;fields.topic_id=id;
return db.from("progress").upsert(fields).select().single().then(function(r){if(r.error){if(btn)btn.disabled=false;return msg("mm",r.error.message)}PROG[id]=r.data;topicModal(id)})}
document.querySelectorAll("#mbody [data-undo]").forEach(function(a){a.onclick=function(e){e.preventDefault();if(!confirm("Undo this step? You can mark it again later."))return;var f={};f[a.dataset.undo]=null;if(a.dataset.undo==="mcq_at")f.mcq_score=null;save(f,null)}});
document.querySelectorAll("#mbody [data-mk]").forEach(function(bt){bt.onclick=function(){var f={};f[bt.dataset.mk]=new Date().toISOString();if(bt.dataset.mk==="mcq_at")f.mcq_score=$("mS").value.trim()||null;save(f,bt)}});
if($("aA"))$("aA").onclick=function(){var f=$("aF").files,bt=this;if(!f.length)return msg("mm","Choose your answer: one PDF, or photos of each page.");bt.disabled=true;msg("mm","Compressing and uploading…",true);
upCopy(ME.id,id,"answer",f).then(function(path){var x=preFields(t,PROG[id]||{});x.answer_path=path;x.answer_at=new Date().toISOString();return save(x,bt)}).catch(function(e){bt.disabled=false;msg("mm",e.message)})};
if($("vA"))$("vA").onclick=function(e){e.preventDefault();openFile(p.answer_path)};if($("vE"))$("vE").onclick=function(e){e.preventDefault();openFile(p.eval_path)}}

/* ================= mentor ================= */
function mentorHome(){Promise.all([
db.from("profiles").select("*").eq("mentor_id",ME.id).eq("status","active").order("full_name"),
db.from("topics").select("*").order("sort_order").order("id"),
db.from("progress").select("*"),
db.from("batches").select("*"),
db.from("student_batches").select("*")])
.then(function(r){STUDENTS=r[0].data||[];
BATCHES={};(r[3].data||[]).forEach(function(b){BATCHES[b.id]=b});
SB={};(r[4].data||[]).forEach(function(x){(SB[x.student_id]=SB[x.student_id]||[]).push(String(x.batch_id))});
var ids={};bset(ME).forEach(function(b){ids[b]=1});STUDENTS.forEach(function(s){bset(s).forEach(function(b){ids[b]=1})});
MYB=Object.keys(ids).sort(function(a,b){return bname(a).localeCompare(bname(b))});
TOPICS=(r[1].data||[]).filter(function(t){return ids[t.batch_id]});
PROG={};(r[2].data||[]).forEach(function(p){PROG[p.student_id+":"+p.topic_id]=p});
renderMentor()})}

function queue(){var q=[];STUDENTS.forEach(function(s){topicsOf(s).forEach(function(t){var b=BATCHES[t.batch_id]||{},p=PROG[s.id+":"+t.id];if(!p)return;
mapOf(t).steps.forEach(function(x){if(x.w==="M"&&p[x.from]&&!p[x.f])q.push([s,t,x.todo||x.l,new Date(p[x.from]).getTime()+(b[x.hrs]||48)*36e5])})})});return q.sort(function(a,b){return a[3]-b[3]})}
function tname(t){var dl=dayLabel(t);return dl.d?dl.d+(dl.topic?" – "+dl.topic:""):t.title}

function renderMentor(){var q=queue(),od=q.filter(function(x){return x[3]<Date.now()}).length;
var h='<h1>Mentor dashboard</h1><div class="stats"><div><b>'+STUDENTS.length+'</b><span>your students</span></div><div><b>'+q.length+'</b><span>tasks pending</span></div><div><b>'+od+'</b><span>overdue</span></div><div><b>'+TOPICS.filter(function(t){return!t.class_done&&mapOf(t).steps.some(function(s){return s.f==="class_done"})}).length+'</b><span>classes yet to be taken</span></div></div>'
+'<div class="tabs"><button type="button" data-v="queue" aria-pressed="'+(VIEW==="queue")+'">Work queue</button><button type="button" data-v="students" aria-pressed="'+(VIEW==="students")+'">Students</button><button type="button" data-v="topics" aria-pressed="'+(VIEW==="topics")+'">Batch topics</button><button type="button" data-v="lib" aria-pressed="'+(VIEW==="lib")+'">Premium Library</button></div>';
if(VIEW==="lib")h+='<div id="pnRoot"><div class="card">Loading the Premium Library…</div></div>';
if(VIEW==="queue")h+='<div class="card"><h2>Work queue</h2>'+(q.length?'<ul class="queue">'+q.map(function(x){var ms=x[3]-Date.now();return'<li><span class="due'+(ms<0?" o":"")+'">'+dueTxt(ms)+'</span><span><b>'+esc(x[2])+'</b> · '+esc(x[0].full_name)+'<br><small>'+esc(bname(x[1].batch_id))+' · '+esc(x[1].subject)+': '+esc(tname(x[1]))+(x[0].phone?' · '+esc(x[0].phone):'')+'</small></span><button class="btn s p" data-st="'+x[0].id+'" data-tp="'+x[1].id+'">Open</button></li>'}).join("")+'</ul>':'<p style="color:var(--mu)">All caught up.</p>')+'</div>';
if(VIEW==="students"){h+='<div class="card"><h2>Your students</h2>'+(STUDENTS.length?'<table><tr><th>Student</th><th>Batches</th><th>Progress</th><th class="hide-m">Avg ★</th><th class="hide-m">Pending</th><th></th></tr>'+STUDENTS.map(function(s){var ts=topicsOf(s),d=0,all=0,pend=0,sum=0,n=0;ts.forEach(function(t){var p=PROG[s.id+":"+t.id],st=stepState(t,p);all+=st.length;st.forEach(function(x){if(x==="d")d++;if(x==="w"||x==="o")pend++});if(p&&p.stars!=null){sum+=p.stars;n++}});var pc=all?Math.round(d/all*100):0;
return'<tr><td><b>'+esc(s.full_name)+'</b><br><small>'+esc(s.phone||"")+'</small></td><td>'+esc(bset(s).map(bname).join(", "))+'</td><td><div class="bar"><i style="width:'+pc+'%"></i></div><small>'+pc+'%</small></td><td class="hide-m">'+(n?(sum/n).toFixed(1):"–")+'</td><td class="hide-m">'+pend+'</td><td><button class="btn s" data-sv="'+s.id+'">Open</button></td></tr>'}).join("")+'</table>':'<p style="color:var(--mu)">No students are assigned to you yet.</p>')+'</div>';
if(SEL){var s=STUDENTS.filter(function(x){return x.id===SEL})[0];if(s){h+='<div class="card"><h2>'+esc(s.full_name)+'</h2>'+legend();
bset(s).forEach(function(bid){var ts=TOPICS.filter(function(t){return String(t.batch_id)===bid});if(!ts.length)return;h+='<h3 style="margin:16px 0 4px">'+esc(bname(bid))+' <small style="color:var(--mu);font:600 13px Hanken Grotesk">· '+esc(mapOfB(bid).name)+' map</small></h3>';var last="";
ts.forEach(function(t){if(t.subject!==last){last=t.subject;h+='<p class="subj">'+esc(t.subject)+'</p>'}h+='<div class="trow" data-st="'+s.id+'" data-tp="'+t.id+'"><span><b>'+esc(tname(t))+'</b></span>'+dots(stepState(t,PROG[s.id+":"+t.id]))+'<span class="btn s hide-m">Open</span></div>'});
h+='<p class="subj" style="color:var(--d)">Improvement graph</p>'+graph(ts.map(function(t){return[t,PROG[s.id+":"+t.id]]}))});
h+='</div>'}}}
if(VIEW==="topics"){h+='<div class="card"><h2>Batch topics</h2><p style="color:var(--mu)">Tick when a class (or brainstorming) is done and when notes are shared. Students see it on their map.</p>';
if(!MYB.length)h+='<p>No batches are assigned to you yet.</p>';
MYB.forEach(function(bid){var list=TOPICS.filter(function(t){return String(t.batch_id)===String(bid)}),mp=mapOfB(bid),cs=mp.steps.filter(function(x){return x.f==="class_done"})[0],ns=mp.steps.filter(function(x){return x.f==="notes_done"})[0];
h+='<h3 style="margin:20px 0 6px">'+esc(bname(bid))+'</h3>';
h+=list.length?'<table><tr><th>Topic</th>'+(cs?'<th>'+esc(cs.l)+'</th>':'')+(ns?'<th>Notes shared</th><th>Notes link</th>':'')+'</tr>'+list.map(function(t){return'<tr><td><small>'+esc(t.subject)+'</small><br><b>'+esc(tname(t))+'</b>'+(t.task_url?'<br><a href="'+esc(t.task_url)+'" target="_blank" rel="noopener">📄 Task PDF</a>':'')+'</td>'
+(cs?'<td><input type="checkbox" data-tc="'+t.id+'"'+(t.class_done?" checked":"")+'></td>':'')
+(ns?'<td><input type="checkbox" data-tn="'+t.id+'"'+(t.notes_done?" checked":"")+'></td><td><span class="inl"><input data-tl="'+t.id+'" value="'+esc(t.notes_url||"")+'" placeholder="https://…"><button class="btn s" data-tls="'+t.id+'">Save</button></span></td>':'')+'</tr>'}).join("")+'</table>':'<p style="color:var(--mu)">No topics added to this batch yet.</p>'});
h+='</div>'}
H(h);if(VIEW==="lib"&&typeof premiumInto==="function")premiumInto("pnRoot");document.querySelectorAll("[data-v]").forEach(function(b){b.onclick=function(){VIEW=b.dataset.v;renderMentor()}});
document.querySelectorAll("[data-sv]").forEach(function(b){b.onclick=function(){SEL=b.dataset.sv;renderMentor()}});
document.querySelectorAll("[data-tp]").forEach(function(b){b.onclick=function(){mentorModal(b.dataset.st,+b.dataset.tp)}});
document.querySelectorAll("[data-tc],[data-tn]").forEach(function(c){c.onchange=function(){var f={};f[c.dataset.tc?"class_done":"notes_done"]=c.checked;db.from("topics").update(f).eq("id",c.dataset.tc||c.dataset.tn).then(function(r){if(r.error){alert(r.error.message);c.checked=!c.checked}else mentorHome()})}});
document.querySelectorAll("[data-tls]").forEach(function(b){b.onclick=function(){var v=document.querySelector('[data-tl="'+b.dataset.tls+'"]').value.trim();if(v&&!/^https?:\/\//.test(v))return alert("Please paste a full link starting with https://");db.from("topics").update({notes_url:v||null}).eq("id",b.dataset.tls).then(function(r){r.error?alert(r.error.message):(b.textContent="Saved")})}})}

/* ================= mentor task window (with stars out of 10) ================= */
function mentorModal(sid,tid){var s=STUDENTS.filter(function(x){return x.id===sid})[0],t=TOPICS.filter(function(x){return x.id===tid})[0];if(!s||!t)return;
var p=PROG[sid+":"+tid]||{},m=mapOf(t),st=stepState(t,p);
var STARS='<select id="eS"><option value="">Stars…</option>'+[10,9,8,7,6,5,4,3,2,1,0].map(function(n){return'<option value="'+n+'">★ '+n+' / 10</option>'}).join("")+'</select>';
var info=m.steps.map(function(x,i){var v=st[i];
if(x.w==="T")return v==="d"?"Done":"Not yet";
if(x.upload)return p.answer_at?'Submitted '+fmtT(p.answer_at)+' · <a href="#" id="vA">Open answer sheet</a>':"Not yet";
if(x.w==="S")return v==="d"?"Marked "+fmtT(p[x.f])+(x.k==="mcq"&&p.mcq_score?" · Score "+esc(p.mcq_score):""):"Not yet";
if(x.k==="oral")return p.oral_at?"Done "+fmtT(p.oral_at)+" · Score "+(p.oral_score||"–")+"/5"+(p.oral_remarks?"<br>"+esc(p.oral_remarks):""):(p.understood_at?'Call '+esc(s.full_name)+(s.phone?' on <b>'+esc(s.phone)+'</b>':'')+', then record:<span class="inl"><select id="oS"><option value="">Score</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select><input id="oR" placeholder="Remarks"><button class="btn s p" id="bO">Save oral test</button></span>':"Waiting for the student");
if(x.k==="eval")return p.eval_at?"Done "+fmtT(p.eval_at)+(p.stars!=null?' · <b class="star">★ '+p.stars+'/10</b>':"")+" · Marks "+esc(p.eval_marks||"–")+(p.eval_path?' · <a href="#" id="vE">Evaluated copy</a>':"")+(p.eval_remarks?"<br>"+esc(p.eval_remarks):""):(p.answer_at?'<span class="inl">'+STARS+'<input id="eM" placeholder="Marks, e.g. 6/10 (optional)"></span><span class="inl"><input id="eF" type="file" accept="application/pdf,image/*" multiple title="Evaluated copy: one PDF (max 5 MB), or photos of each page"></span><textarea id="eR" placeholder="Written feedback"></textarea><button class="btn s p" id="bE" style="margin-top:6px">Save evaluation</button>':"Waiting for the answer");
if(x.k==="improve")return p.improve_at?"Done "+fmtT(p.improve_at)+(p.improve_notes?"<br>"+esc(p.improve_notes):""):(p.eval_at?'<textarea id="iN" placeholder="Key points discussed on the call"></textarea><button class="btn s p" id="bI" style="margin-top:6px">Save improvement call</button>':"After evaluation");
if(x.k==="content")return p.content_at?"Done "+fmtT(p.content_at)+' · <a href="#" class="undo" id="uC">Undo</a>':(p.improve_at?'<button class="btn s p" id="bC">Content prepared and shared</button>':"After the improvement call");return""});
modal('<p class="subj" style="margin-top:0">'+esc(s.full_name)+' · '+esc(t.subject)+'</p><h2>'+esc(tname(t))+'</h2>'+(t.task_url?'<p><a class="btn s p" href="'+esc(t.task_url)+'" target="_blank" rel="noopener">📄 Task questions (PDF)</a></p>':'')
+m.steps.map(function(x,i){return'<div class="step '+(st[i]&&st[i]!=="n"?"s"+st[i]:"")+'"><span class="n">'+(st[i]==="d"?"✓":i+1)+'</span><div><b>'+esc(x.l)+'</b><span class="who">'+(x.w==="S"?"Student":WHO[x.w])+'</span><p>'+info[i]+'</p></div></div>'}).join("")+'<div id="mm"></div>');
function save(f,b){b.disabled=true;f.student_id=sid;f.topic_id=tid;return db.from("progress").upsert(f).select().single().then(function(r){if(r.error){b.disabled=false;return msg("mm",r.error.message)}PROG[sid+":"+tid]=r.data;mentorModal(sid,tid)})}
if($("bO"))$("bO").onclick=function(){if(!$("oS").value)return msg("mm","Choose a score from 1 to 5.");save({oral_at:new Date().toISOString(),oral_score:+$("oS").value,oral_remarks:$("oR").value.trim()||null},this)};
if($("bE"))$("bE").onclick=function(){if($("eS").value==="")return msg("mm","Give stars out of 10. They build the student’s improvement graph.");var b=this,f=$("eF").files[0]?$("eF").files:null;b.disabled=true;msg("mm",f?"Compressing and uploading…":"",true);
(f?upCopy(sid,tid,"evaluated",f):Promise.resolve(null)).then(function(path){var x={eval_at:new Date().toISOString(),stars:+$("eS").value,eval_marks:$("eM").value.trim()||null,eval_remarks:$("eR").value.trim()||null};if(path)x.eval_path=path;return save(x,b)}).catch(function(e){b.disabled=false;msg("mm",e.message)})};
if($("bI"))$("bI").onclick=function(){save({improve_at:new Date().toISOString(),improve_notes:$("iN").value.trim()||null},this)};
if($("bC"))$("bC").onclick=function(){save({content_at:new Date().toISOString()},this)};
if($("uC"))$("uC").onclick=function(e){e.preventDefault();if(confirm("Undo “content prepared”?"))save({content_at:null},this)};
if($("vA"))$("vA").onclick=function(e){e.preventDefault();openFile(p.answer_path)};if($("vE"))$("vE").onclick=function(e){e.preventDefault();openFile(p.eval_path)}}
