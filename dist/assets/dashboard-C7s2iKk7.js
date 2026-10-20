import{s as p}from"./supabase-CdWdxYWD.js";const i={currentWorkspace:"mira",currentUser:null,activeTag:"all",questions:[{id:1,rollId:"Roll #23-CS-042",timeAgo:"15 mins ago",content:"Can someone explain the difference between TCP and UDP handshakes? In what scenario would packet loss in UDP break the entire connection state?",tags:["Computer Networks","CS Core"],replies:[{author:"Teacher / Mod",isTeacher:!0,text:"Great question. TCP relies on a 3-way SYN-ACK handshake to guarantee order and delivery. UDP is connectionless without ACKs; application-level sequencing must handle losses if critical."}]},{id:2,rollId:"Roll #24-EC-109",timeAgo:"1 hour ago",content:"Need help with Op-Amp differential amplifier derivation. What happens when the input resistors are mismatched by 5%?",tags:["Electronics","Assignments"],replies:[{author:"Roll #23-EC-088",isTeacher:!1,text:"Mismatched resistors severely degrade the Common Mode Rejection Ratio (CMRR). Check page 142 of Sedra & Smith!"}]}],attendanceList:[{roll:"Roll #01",name:"Aarav Sharma",status:"present"},{roll:"Roll #02",name:"Ananya Verma",status:"present"},{roll:"Roll #03",name:"Devansh Patil",status:"absent"},{roll:"Roll #04",name:"Ishita Nair",status:"present"},{roll:"Roll #05",name:"Kabir Mehta",status:"late"},{roll:"Roll #06",name:"Meera Iyer",status:"present"},{roll:"Roll #07",name:"Rohan Gupta",status:"present"}],files:[{name:"Fluid_Mechanics_Lecture_04.pdf",size:"3.4 MB",date:"Today, 10:30 AM"},{name:"Linear_Algebra_Assignment_2.pdf",size:"1.2 MB",date:"Yesterday"},{name:"Exam_Guidelines_Midterm_2026.pdf",size:"840 KB",date:"16 Oct"}],meetings:[{title:"Parent-Teacher Academic Review",time:"Today · 3:00 PM",attendees:"14 joined"},{title:"Project Demo Session — Batch B",time:"Tomorrow · 11:30 AM",attendees:"8 scheduled"},{title:"Faculty Department Sync",time:"Friday · 4:00 PM",attendees:"6 scheduled"}]};document.addEventListener("DOMContentLoaded",async()=>{const{data:{session:e}}=await p.auth.getSession();e!=null&&e.user&&(i.currentUser=e.user,C(e.user));const n=new URLSearchParams(window.location.search).get("view");if(n==="knownext"||n==="mira")d(n);else{const s=localStorage.getItem("mira_active_workspace")||"mira";d(s)}k(),g(),l(),h(),f()});function d(e){i.currentWorkspace=e,document.body.setAttribute("data-workspace",e),localStorage.setItem("mira_active_workspace",e);const t=document.getElementById("btn-switch-mira"),n=document.getElementById("btn-switch-knownext");t&&n&&(t.setAttribute("aria-selected",e==="mira"?"true":"false"),n.setAttribute("aria-selected",e==="knownext"?"true":"false"));const s=document.getElementById("view-mira"),a=document.getElementById("view-knownext");e==="mira"?(a==null||a.classList.remove("active"),setTimeout(()=>{s==null||s.classList.add("active")},50)):(s==null||s.classList.remove("active"),setTimeout(()=>{a==null||a.classList.add("active")},50));const o=new URL(window.location);o.searchParams.set("view",e),window.history.replaceState({},"",o)}function y(){const e=i.currentWorkspace==="mira"?"knownext":"mira";d(e)}function v(){const e=["CS","EC","ME","CE","IT"],t=e[Math.floor(Math.random()*e.length)],n=String(Math.floor(Math.random()*899)+100);return`Roll #26-${t}-${n}`}function E(){const e=document.getElementById("new-question-input"),t=e==null?void 0:e.value.trim();if(!t){c("Please type your question or doubt first!","info");return}const n=document.querySelector(".tag-chip.active"),s=(n==null?void 0:n.textContent.replace("#",""))||"General",a={id:Date.now(),rollId:v(),timeAgo:"Just now (Live)",content:t,tags:[s],replies:[]};i.questions.unshift(a),e&&(e.value=""),l(),c("Question posted anonymously to KnowNext live feed! 🚀","success")}function b(e){var a,o;const t=document.getElementById(`reply-input-${e}`),n=t==null?void 0:t.value.trim();if(!n)return;const s=i.questions.find(r=>r.id===e);if(s){const r=((o=(a=i.currentUser)==null?void 0:a.user_metadata)==null?void 0:o.role)==="teacher",w=r?"Teacher / Educator":v();s.replies.push({author:w,isTeacher:r,text:n}),l(),c("Answer added to discussion!","success")}}function l(){const e=document.getElementById("knownext-feed-container");if(!e)return;const t=i.activeTag==="all"?i.questions:i.questions.filter(n=>n.tags.some(s=>s.toLowerCase().includes(i.activeTag.toLowerCase())));e.innerHTML=t.map(n=>`
    <div class="question-card" id="q-card-${n.id}">
      <div class="question-top">
        <div class="roll-author-badge">
          <div class="roll-avatar">🎓</div>
          <div>
            <span class="roll-id-text">${n.rollId}</span>
            <span class="privacy-tag">🔒 Anonymous Student</span>
          </div>
        </div>
        <span class="post-time">${n.timeAgo}</span>
      </div>

      <div class="question-body">
        ${m(n.content)}
      </div>

      <div class="question-tags-row">
        ${n.tags.map(s=>`<span class="question-tag">#${s}</span>`).join("")}
      </div>

      <div class="answers-section">
        <div class="answers-list" id="answers-${n.id}">
          ${n.replies.map(s=>`
            <div class="reply-item">
              <span class="reply-author-icon">${s.isTeacher?"👨‍🏫":"💬"}</span>
              <div class="reply-content">
                <div class="reply-meta">
                  <span class="reply-name">${s.author}</span>
                  ${s.isTeacher?'<span class="badge-teacher">Teacher Verified</span>':""}
                </div>
                <div>${m(s.text)}</div>
              </div>
            </div>
          `).join("")}
        </div>

        <div class="reply-box">
          <input
            type="text"
            id="reply-input-${n.id}"
            class="reply-input"
            placeholder="Write a helpful answer or solution..."
            onkeydown="if(event.key === 'Enter') addReply(${n.id})"
          />
          <button class="btn-reply-send" onclick="addReply(${n.id})">Reply</button>
        </div>
      </div>
    </div>
  `).join("")}function L(e){const t=i.attendanceList[e];if(!t)return;const n={present:"absent",absent:"late",late:"present"};t.status=n[t.status],g()}function g(){const e=document.getElementById("attendance-tbody"),t=document.getElementById("present-count");if(!e)return;const n=i.attendanceList.filter(s=>s.status==="present").length;t&&(t.textContent=`${n} / ${i.attendanceList.length}`),e.innerHTML=i.attendanceList.map((s,a)=>`
    <tr>
      <td><strong>${s.roll}</strong></td>
      <td>${s.name}</td>
      <td>
        <span class="attendance-pill ${s.status}" onclick="toggleStudentAttendance(${a})">
          ${s.status.toUpperCase()}
        </span>
      </td>
    </tr>
  `).join("")}function u(e){if(!(!e||e.length===0)){for(let t=0;t<e.length;t++){const n=e[t];i.files.unshift({name:n.name,size:`${(n.size/(1024*1024)).toFixed(1)} MB`,date:"Just now"})}h(),c(`${e.length} document(s) uploaded and indexed!`,"success")}}function h(){const e=document.getElementById("file-list-container");e&&(e.innerHTML=i.files.map(t=>`
    <div class="file-item">
      <div class="file-left">
        <span class="pdf-icon-badge">PDF</span>
        <div>
          <div class="file-name">${t.name}</div>
          <div class="file-sub">${t.size} · ${t.date}</div>
        </div>
      </div>
      <button class="btn-subtle" style="padding:4px 10px; font-size:0.75rem;" onclick="showToast('Opening document viewer...', 'info')">Open</button>
    </div>
  `).join(""))}function $(){const e=prompt("Enter meeting title:","Live Study Group Session");e&&(i.meetings.unshift({title:e,time:"Happening Now · Live",attendees:"1 host"}),f(),c(`Meeting "${e}" created and live!`,"success"))}function f(){const e=document.getElementById("meetings-list-container");e&&(e.innerHTML=i.meetings.map(t=>`
    <div class="meeting-card-item">
      <div>
        <div class="meeting-time">${t.time}</div>
        <div class="meeting-title">${t.title}</div>
        <div class="meeting-meta">👥 ${t.attendees}</div>
      </div>
      <button class="btn-mira" style="padding:6px 12px; font-size:0.78rem;" onclick="showToast('Connecting to meeting room...', 'info')">Join</button>
    </div>
  `).join(""))}function k(){var n,s,a;(n=document.getElementById("btn-switch-mira"))==null||n.addEventListener("click",()=>d("mira")),(s=document.getElementById("btn-switch-knownext"))==null||s.addEventListener("click",()=>d("knownext")),document.querySelectorAll(".tag-chip").forEach(o=>{o.addEventListener("click",()=>{document.querySelectorAll(".tag-chip").forEach(r=>r.classList.remove("active")),o.classList.add("active"),i.activeTag=o.dataset.tag||"all",l()})});const e=document.getElementById("upload-dropzone"),t=document.getElementById("pdf-file-input");e==null||e.addEventListener("click",()=>t==null?void 0:t.click()),t==null||t.addEventListener("change",o=>u(o.target.files)),e==null||e.addEventListener("dragover",o=>{o.preventDefault(),e.style.borderColor="var(--mira-primary)"}),e==null||e.addEventListener("dragleave",()=>{e.style.borderColor=""}),e==null||e.addEventListener("drop",o=>{o.preventDefault(),e.style.borderColor="",u(o.dataTransfer.files)}),(a=document.getElementById("btn-dashboard-signout"))==null||a.addEventListener("click",async()=>{await p.auth.signOut(),window.location.href="/"})}function C(e){var a;const t=document.getElementById("header-user-name"),n=document.getElementById("header-user-avatar"),s=((a=e.user_metadata)==null?void 0:a.full_name)||e.email||"Student";t&&(t.textContent=s),n&&(n.textContent=s.charAt(0).toUpperCase())}function m(e){return e.replace(/[&<>'"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[t]||t)}function c(e,t="info"){const n=document.createElement("div");n.className=`toast toast-${t}`,n.textContent=e,document.body.appendChild(n),requestAnimationFrame(()=>n.classList.add("show")),setTimeout(()=>{n.classList.remove("show"),setTimeout(()=>n.remove(),350)},3500)}window.switchWorkspace=d;window.toggleWorkspace=y;window.postQuestion=E;window.addReply=b;window.toggleStudentAttendance=L;window.createInstantMeeting=$;
//# sourceMappingURL=dashboard-C7s2iKk7.js.map
