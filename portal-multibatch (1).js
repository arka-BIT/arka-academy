/* Arka portal: multi-batch support + Premium Library tabs ("Also in" batches from student_batches).
   Load this AFTER the main script in portal.html:
   <script src="portal-multibatch.js"></script>  (just before </body>) */

var SB={},MYB=[];
function bname(b){return(BATCHES[b]||{}).name||"Batch"}
function bset(p){var a=[];if(p.batch_id)a.push(String(p.batch_id));(SB[p.id]||[]).forEach(function(b){if(a.indexOf(b)<0)a.push(b)});return a}
function topicsOf(p){var bs=bset(p);return TOPICS.filter(function(t){return bs.indexOf(String(t.batch_id))>-1})}

/* every topic uses the deadlines of its own batch */
var _state=state;
state=function(t,p,b){return _state(t,p,BATCHES[t.batch_id]||b)};
var _topicModal=topicModal;
topicModal=function(id){var t=TOPICS.filter(function(x){return x.id===id})[0];if(t&&BATCHES[t.batch_id])BATCH=BATCHES[t.batch_id];_topicModal(id)};

/* ---------- student ---------- */
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
var mine=bset(ME);
TOPICS=(r[1].data||[]).filter(function(t){return mine.indexOf(String(t.batch_id))>-1});
TOPICS.sort(function(a,b){return mine.indexOf(String(a.batch_id))-mine.indexOf(String(b.batch_id))});
BATCH={name:mine.map(bname).join(" + "),oral_hours:48,eval_hours:24,improve_hours:48};
PROG={};(r[2].data||[]).forEach(function(p){PROG[p.topic_id]=p});var mt=(r[3].data||[])[0];
var all=0,done=0,full=0,wait=0,todo=[];
TOPICS.forEach(function(t){var st=state(t,PROG[t.id]);all+=8;st.forEach(function(x){if(x==="d")done++;if(x==="w"||x==="o")wait++});if(st.every(function(x){return x==="d"}))full++;
if(st[2]==="n")todo.push([t,"Mark “Understood” when ready"]);else{if(st[4]==="n")todo.push([t,"Attempt the MCQ test"]);if(st[5]==="n")todo.push([t,"Write and upload your answers"])}});
var h=(typeof pvTabs==="function"?pvTabs():"")+'<h1>Hello, '+esc(ME.full_name.split(" ")[0])+'</h1><p style="color:var(--mu);margin-top:-6px">'+esc(BATCH.name||"Your batch")+(mt?' · Mentor: <b>'+esc(mt.full_name)+'</b>'+(mt.phone?' ('+esc(mt.phone)+')':''):'')+'</p>'
+'<div class="stats"><div><b>'+(all?Math.round(done/all*100):0)+'%</b><span>steps complete</span></div><div><b>'+full+'/'+TOPICS.length+'</b><span>topics fully done</span></div><div><b>'+todo.length+'</b><span>tasks waiting on you</span></div><div><b>'+wait+'</b><span>waiting on your mentor</span></div></div>';
h+='<div class="card"><h2>Your next tasks</h2>'+(todo.length?'<ul class="queue">'+todo.slice(0,8).map(function(m){return'<li><span class="tag">'+esc(m[0].subject)+'</span><span><b>'+esc(m[0].title)+'</b><br><small>'+m[1]+'</small></span><button class="btn s" data-t="'+m[0].id+'">Open</button></li>'}).join("")+'</ul>':'<p style="color:var(--mu)">Nothing pending right now. Well done.</p>')+'</div>';
h+='<div class="card"><h2>Your responsibility map</h2>'+LEG;var last="",lb="";
if(!TOPICS.length)h+='<p style="color:var(--mu)">Your batch topics will appear here once classes are scheduled.</p>';
TOPICS.forEach(function(t){
if(String(t.batch_id)!==lb){lb=String(t.batch_id);last="";if(mine.length>1)h+='<h3 style="margin:18px 0 2px">'+esc(bname(lb))+'</h3>'}
if(t.subject!==last){last=t.subject;h+='<p class="subj">'+esc(t.subject)+'</p>'}
h+='<div class="trow" data-t="'+t.id+'"><span><b>'+esc(t.title)+'</b>'+(t.class_date?'<br><small>Class: '+esc(t.class_date)+'</small>':'')+'</span>'+dots(state(t,PROG[t.id]))+'<span class="btn s hide-m">Open</span></div>'});
H(h+'</div>');if(typeof wirePV==="function")wirePV();document.querySelectorAll("[data-t]").forEach(function(el){el.onclick=function(){topicModal(+el.dataset.t)}})})}

/* ---------- mentor ---------- */
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

function queue(){var q=[],now=Date.now();STUDENTS.forEach(function(s){topicsOf(s).forEach(function(t){var b=BATCHES[t.batch_id]||{},p=PROG[s.id+":"+t.id];if(!p)return;
if(p.understood_at&&!p.oral_at)q.push([s,t,"Oral test call",new Date(p.understood_at).getTime()+(b.oral_hours||48)*36e5]);
if(p.answer_at&&!p.eval_at)q.push([s,t,"Evaluate answers",new Date(p.answer_at).getTime()+(b.eval_hours||24)*36e5]);
if(p.eval_at&&!p.improve_at)q.push([s,t,"Improvement call",new Date(p.eval_at).getTime()+(b.improve_hours||48)*36e5])})});return q.sort(function(a,b){return a[3]-b[3]})}

function renderMentor(){var q=queue(),od=q.filter(function(x){return x[3]<Date.now()}).length;
var h='<h1>Mentor dashboard</h1><div class="stats"><div><b>'+STUDENTS.length+'</b><span>your students</span></div><div><b>'+q.length+'</b><span>tasks pending</span></div><div><b>'+od+'</b><span>overdue</span></div><div><b>'+TOPICS.filter(function(t){return!t.class_done}).length+'</b><span>topics yet to be taught</span></div></div>'
+'<div class="tabs"><button type="button" data-v="queue" aria-pressed="'+(VIEW==="queue")+'">Work queue</button><button type="button" data-v="students" aria-pressed="'+(VIEW==="students")+'">Students</button><button type="button" data-v="topics" aria-pressed="'+(VIEW==="topics")+'">Batch topics</button><button type="button" data-v="lib" aria-pressed="'+(VIEW==="lib")+'">Premium Library</button></div>';
if(VIEW==="lib")h+='<div id="pnRoot"><div class="card">Loading the Premium Library…</div></div>';
if(VIEW==="queue")h+='<div class="card"><h2>Work queue</h2>'+(q.length?'<ul class="queue">'+q.map(function(x){var ms=x[3]-Date.now();return'<li><span class="due'+(ms<0?" o":"")+'">'+dueTxt(ms)+'</span><span><b>'+esc(x[2])+'</b> · '+esc(x[0].full_name)+'<br><small>'+esc(bname(x[1].batch_id))+' · '+esc(x[1].subject)+': '+esc(x[1].title)+(x[0].phone?' · '+esc(x[0].phone):'')+'</small></span><button class="btn s p" data-st="'+x[0].id+'" data-tp="'+x[1].id+'">Open</button></li>'}).join("")+'</ul>':'<p style="color:var(--mu)">All caught up.</p>')+'</div>';
if(VIEW==="students"){h+='<div class="card"><h2>Your students</h2>'+(STUDENTS.length?'<table><tr><th>Student</th><th>Batches</th><th>Progress</th><th class="hide-m">Pending</th><th></th></tr>'+STUDENTS.map(function(s){var ts=topicsOf(s),d=0,pend=0;ts.forEach(function(t){state(t,PROG[s.id+":"+t.id]).forEach(function(x){if(x==="d")d++;if(x==="w"||x==="o")pend++})});var pc=ts.length?Math.round(d/(ts.length*8)*100):0;
return'<tr><td><b>'+esc(s.full_name)+'</b><br><small>'+esc(s.phone||"")+'</small></td><td>'+esc(bset(s).map(bname).join(", "))+'</td><td><div class="bar"><i style="width:'+pc+'%"></i></div><small>'+pc+'%</small></td><td class="hide-m">'+pend+'</td><td><button class="btn s" data-sv="'+s.id+'">Open</button></td></tr>'}).join("")+'</table>':'<p style="color:var(--mu)">No students are assigned to you yet.</p>')+'</div>';
if(SEL){var s=STUDENTS.filter(function(x){return x.id===SEL})[0];if(s){h+='<div class="card"><h2>'+esc(s.full_name)+'</h2>'+LEG;
bset(s).forEach(function(bid){var ts=TOPICS.filter(function(t){return String(t.batch_id)===bid});if(!ts.length)return;h+='<h3 style="margin:16px 0 4px">'+esc(bname(bid))+'</h3>';var last="";
ts.forEach(function(t){if(t.subject!==last){last=t.subject;h+='<p class="subj">'+esc(t.subject)+'</p>'}h+='<div class="trow" data-st="'+s.id+'" data-tp="'+t.id+'"><span><b>'+esc(t.title)+'</b></span>'+dots(state(t,PROG[s.id+":"+t.id]))+'<span class="btn s hide-m">Open</span></div>'})});
h+='</div>'}}}
if(VIEW==="topics"){h+='<div class="card"><h2>Batch topics</h2><p style="color:var(--mu)">Tick when a class is delivered and when notes are shared. Students see it on their map.</p>';
if(!MYB.length)h+='<p>No batches are assigned to you yet.</p>';
MYB.forEach(function(bid){var list=TOPICS.filter(function(t){return String(t.batch_id)===String(bid)});h+='<h3 style="margin:20px 0 6px">'+esc(bname(bid))+'</h3>';
h+=list.length?'<table><tr><th>Topic</th><th>Class delivered</th><th>Notes shared</th><th>Notes link</th></tr>'+list.map(function(t){return'<tr><td><small>'+esc(t.subject)+'</small><br><b>'+esc(t.title)+'</b></td><td><input type="checkbox" data-tc="'+t.id+'"'+(t.class_done?" checked":"")+'></td><td><input type="checkbox" data-tn="'+t.id+'"'+(t.notes_done?" checked":"")+'></td><td><span class="inl"><input data-tl="'+t.id+'" value="'+esc(t.notes_url||"")+'" placeholder="https://…"><button class="btn s" data-tls="'+t.id+'">Save</button></span></td></tr>'}).join("")+'</table>':'<p style="color:var(--mu)">No topics added to this batch yet.</p>'});
h+='</div>'}
H(h);if(VIEW==="lib"&&typeof premiumInto==="function")premiumInto("pnRoot");document.querySelectorAll("[data-v]").forEach(function(b){b.onclick=function(){VIEW=b.dataset.v;renderMentor()}});
document.querySelectorAll("[data-sv]").forEach(function(b){b.onclick=function(){SEL=b.dataset.sv;renderMentor()}});
document.querySelectorAll("[data-tp]").forEach(function(b){b.onclick=function(){mentorModal(b.dataset.st,+b.dataset.tp)}});
document.querySelectorAll("[data-tc],[data-tn]").forEach(function(c){c.onchange=function(){var f={};f[c.dataset.tc?"class_done":"notes_done"]=c.checked;db.from("topics").update(f).eq("id",c.dataset.tc||c.dataset.tn).then(function(r){if(r.error){alert(r.error.message);c.checked=!c.checked}else mentorHome()})}});
document.querySelectorAll("[data-tls]").forEach(function(b){b.onclick=function(){var v=document.querySelector('[data-tl="'+b.dataset.tls+'"]').value.trim();if(v&&!/^https?:\/\//.test(v))return alert("Please paste a full link starting with https://");db.from("topics").update({notes_url:v||null}).eq("id",b.dataset.tls).then(function(r){r.error?alert(r.error.message):(b.textContent="Saved")})}})}