import { useState, useMemo, useCallback } from "react";

/* ──────────────────────────────────────────────────────────
   DATA
────────────────────────────────────────────────────────── */
const TASKS = [
  {code:"01",label:"Bathing/Grooming/PC"},
  {code:"02",label:"Dressing/Undressing"},
  {code:"03",label:"Oral Hygiene"},
  {code:"04",label:"Toileting"},
  {code:"05",label:"Turning/Positioning"},
  {code:"06",label:"Ambulate/mobility/transfers"},
  {code:"07",label:"Monitor Skin Condition"},
  {code:"15",label:"Meal Preparation"},
  {code:"16",label:"Feeding"},
  {code:"17",label:"Meds-reminder/cueing"},
  {code:"18",label:"Laundry"},
  {code:"19",label:"Light Housework"},
  {code:"22",label:"Make bed"},
  {code:"23",label:"Grocery Shop"},
  {code:"26",label:"Socialization"},
  {code:"27",label:"Accompany to Doctor"},
  {code:"90",label:"Monitor safety"},
  {code:"92",label:"Accompany on walks"},
];

const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM",
  "NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const TIPS = {
  visitDate: "Enter the date your shift STARTED (the morning you arrived). For a live-in shift, this is always the morning date — even though your sleep break extends into the following day.",
  empId: "Your Employee ID from your offer letter or most recent pay stub. Contact your scheduler if unsure.",
  scheduledHours: "Select ONLY the hours on your Letter of Assignment (LOA) for this client — NOT 24. Your LOA specifies 10, 11, or 12 paid hours.",
  dailyTasks: "Check EVERY task performed this visit. These must match the client's authorized care plan. Under-documenting is a billing and compliance risk.",
  begin: "The exact time you arrived and began client care. ⚠️ ALWAYS double-check AM vs PM — this is the #1 error caregivers make.",
  end: "This is the PM time when you put the client to sleep and are free and clear from active work duties. It is NOT the following morning — it is the evening time the client goes to bed. ⚠️ Double-check that this is a PM time.",
  breaks: "Record ALL off-duty breaks with exact hours and minutes — do not round to the nearest quarter hour. Example: 12:07 PM to 12:53 PM. Missing or inaccurate breaks cause payroll errors.",
  sleepBreak: "Enter exact hours and minutes for every break — not rounded times. For example: Break 2 Start: 2:17 PM, End: 3:45 PM. The more precise your entries, the more accurate your pay.",
  interruptions: "Record ONLY times you were woken from sleep overnight to provide care (e.g., bathroom assistance, repositioning, medication). These are nighttime interruptions — not daytime tasks. Each interruption converts unpaid sleep time → PAID work time.",
  sleep5: "CT law: caregivers must receive at least 5 consecutive uninterrupted hours of sleep. If you did NOT, call your Scheduling Manager before the shift ends.",
  calcs: "These fields auto-compute from your entries. Review before signing — they directly determine your paycheck.",
  ampm: "⚠️ Most common error: entering PM as AM. A 10 PM entered as 10 AM creates a 12-hour payroll error.",
};

/* ──────────────────────────────────────────────────────────
   TIME UTILS
────────────────────────────────────────────────────────── */
// Time value shape: { hhmm: "8:00", ampm: "AM" }
const defT = () => ({ hhmm:"", ampm:"AM" });
const defP = () => ({ start:defT(), end:defT() });
const tv   = (h,m,ap) => ({ hhmm:`${h}:${String(m).padStart(2,"0")}`, ampm:ap });
const mk6  = (filled=[]) => {
  const a = Array.from({length:6}, defP);
  filled.forEach((f,i) => { a[i] = { start:{...f.start}, end:{...f.end} }; });
  return a;
};

function toMin({hhmm, ampm}) {
  if (!hhmm || !ampm) return null;
  const parts = hhmm.split(":");
  if (parts.length < 2) return null;
  let h=parseInt(parts[0]), m=parseInt(parts[1]);
  if (isNaN(h)||isNaN(m)) return null;
  if (h < 1 || h > 12 || m < 0 || m > 59) return null;
  if (ampm==="PM" && h!==12) h+=12;
  if (ampm==="AM" && h===12) h=0;
  return h*60+m;
}
function spanMin(s,e) {
  const sm=toMin(s), em=toMin(e);
  if (sm===null||em===null) return 0;
  let d=em-sm; if(d<=0) d+=1440; return d;
}
function fmtH(m) {
  if (!m && m!==0) return "—";
  const h=Math.floor(m/60), mn=m%60;
  return mn ? `${h} hrs ${mn} min` : `${h} hrs`;
}
const validPair = b => toMin(b.start)!==null && toMin(b.end)!==null && spanMin(b.start,b.end)>0;

/* ──────────────────────────────────────────────────────────
   SAMPLE SCENARIO
────────────────────────────────────────────────────────── */
const SCENARIO = {
  visitDate:{month:"5",day:"5",year:"2025"},
  empId:"1042", empFirst:"Jane", empLast:"Smith", empEmail:"jsmith@caregivers.com",
  cliFirst:"Robert", cliLast:"Johnson",
  street:"45 Oak Street", street2:"", city:"Hartford", state:"CT", zip:"06103",
  scheduledHours:"10",
  tasks:new Set(["01","02","15","17","19","26","90"]),
  // BEGIN = morning start of active duty; END = PM when client is put to sleep & caregiver free
  begin:tv(8,0,"AM"), end:tv(9,0,"PM"),
  breaks:mk6([
    // Break 1 — lunch / personal time midday
    {start:tv(12,30,"PM"), end:tv(1,0,"PM")},
    // Break 2 — sleep period starts when client goes to bed (matches END time)
    {start:tv(9,0,"PM"), end:tv(6,0,"AM")},
  ]),
  addMore:"no", extraBreaks:mk6(),
  hasInt:"yes",
  // Interruptions happen overnight during the sleep break
  interruptions:mk6([
    {start:tv(2,0,"AM"),  end:tv(2,20,"AM")},   // bathroom assistance
    {start:tv(4,30,"AM"), end:tv(4,45,"AM")},   // repositioning
  ]),
  intNotes:"Interruption 1 (2:00–2:20 AM): Client needed bathroom assistance, assisted with transfer to and from bathroom.\nInterruption 2 (4:30–4:45 AM): Client requested repositioning in bed.",
  gotSleep:"yes", clientCanSign:"yes",
};

/* ──────────────────────────────────────────────────────────
   JOTFORM PRIMITIVES
────────────────────────────────────────────────────────── */

/* JotForm time-picker — exact match to screenshot:
   [ HH : MM  free-type input ]  [ AM / PM dropdown ]
   "Hour Minutes" sub-label below                      */
function JFTime({ value, onChange }) {
  const isValid = toMin(value) !== null;
  const hasInput = value.hhmm && value.hhmm.trim() !== "";
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
        {/* Free-type HH:MM field */}
        <input
          type="text"
          value={value.hhmm}
          onChange={e => onChange({...value, hhmm: e.target.value})}
          placeholder="HH : MM"
          maxLength={5}
          style={{
            width:"138px", height:"42px",
            border:"1px solid #b8b8b8", borderRadius:"4px",
            padding:"0 14px", fontSize:"16px",
            background:"white", color:"#2c3e50",
            fontFamily:"inherit", outline:"none",
            letterSpacing:"0.04em",
          }}
        />
        {/* AM / PM dropdown */}
        <select
          value={value.ampm}
          onChange={e => onChange({...value, ampm: e.target.value})}
          style={{
            width:"85px", height:"42px",
            border:"1px solid #b8b8b8", borderRadius:"4px",
            padding:"0 8px", fontSize:"15px", fontWeight:"600",
            background:"white", color:"#2c3e50",
            fontFamily:"inherit", outline:"none", cursor:"pointer",
          }}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      {/* "Hour Minutes" sub-label — exactly as on JotForm */}
      <div style={{fontSize:"12px",color:"#888",marginTop:"4px",paddingLeft:"1px"}}>
        Hour Minutes
      </div>
      {/* Inline validation hint */}
      {hasInput && !isValid && (
        <div style={{marginTop:"3px",fontSize:"12px",color:"#dc2626"}}>
          Enter exact time, e.g. 9:07 or 10:23 (include exact minutes)
        </div>
      )}
    </div>
  );
}

/* JotForm-style text input */
function JFInput({ value, onChange, placeholder, type="text", style={} }) {
  return (
    <input type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width:"100%", height:"38px", border:"1px solid #b8b8b8", borderRadius:"4px",
        padding:"0 12px", fontSize:"14px", background:"white", color:"#2c3e50",
        fontFamily:"inherit", outline:"none", boxSizing:"border-box", ...style,
      }}/>
  );
}

/* JotForm-style select */
function JFSelect({ value, onChange, children, style={} }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{
        height:"38px", border:"1px solid #b8b8b8", borderRadius:"4px",
        padding:"0 8px", fontSize:"14px", background:"white", color:"#2c3e50",
        fontFamily:"inherit", outline:"none", cursor:"pointer",
        width:"100%", boxSizing:"border-box", ...style,
      }}>
      {children}
    </select>
  );
}

/* JotForm field wrapper — label + required star + children */
function JFField({ label, required, tip, showTips, children, style={} }) {
  return (
    <div style={{marginBottom:"20px",...style}}>
      <div style={{
        display:"flex",alignItems:"flex-start",gap:"6px",
        marginBottom:"6px",
      }}>
        <label style={{
          fontSize:"15px",fontWeight:"700",color:"#2c3e50",
          lineHeight:"1.3",display:"block",
        }}>
          {label}
          {required && <span style={{color:"#ff3b3b",marginLeft:"3px"}}>*</span>}
        </label>
        {showTips && tip && (
          <div title={tip} style={{
            flexShrink:0,marginTop:"2px",width:"18px",height:"18px",
            borderRadius:"50%",background:"#1a73e8",color:"white",
            fontSize:"11px",fontWeight:"700",display:"flex",
            alignItems:"center",justifyContent:"center",cursor:"help",
          }}>i</div>
        )}
      </div>
      {children}
      {showTips && tip && (
        <div style={{
          marginTop:"6px",padding:"8px 12px",
          background:"#fff8e1",border:"1px solid #ffe082",
          borderLeft:"3px solid #f59e0b",borderRadius:"4px",
          fontSize:"12.5px",color:"#6d4c00",lineHeight:"1.5",
        }}>
          💡 {tip}
        </div>
      )}
    </div>
  );
}

/* JotForm horizontal divider with label */
function JFSectionHeader({ label, sub }) {
  return (
    <div style={{marginBottom:"20px",marginTop:"8px"}}>
      <div style={{
        background:"linear-gradient(135deg,#e8513a,#c0392b)",
        color:"white",padding:"10px 16px",borderRadius:"4px",
      }}>
        <div style={{fontWeight:"700",fontSize:"15px"}}>{label}</div>
        {sub && <div style={{fontSize:"12px",opacity:0.9,marginTop:"2px"}}>{sub}</div>}
      </div>
    </div>
  );
}

/* JotForm-style checkbox row */
function JFCheckbox({ code, label, checked, onChange }) {
  return (
    <label onClick={onChange} style={{
      display:"flex",alignItems:"center",gap:"10px",cursor:"pointer",
      padding:"6px 10px",borderRadius:"3px",
      background:checked?"#f0f7ff":"transparent",
      transition:"background 0.1s",
      userSelect:"none",
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{position:"absolute",opacity:0,width:0,height:0,pointerEvents:"none"}}
      />
      <div style={{
        width:"18px",height:"18px",borderRadius:"3px",flexShrink:0,
        border:`2px solid ${checked?"#1a73e8":"#b8b8b8"}`,
        background:checked?"#1a73e8":"white",
        display:"flex",alignItems:"center",justifyContent:"center",
        transition:"all 0.12s",
      }}>
        {checked && (
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
            <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span style={{fontSize:"14px",color:"#2c3e50"}}>
        <span style={{color:"#888",marginRight:"4px",fontWeight:"600"}}>{code}</span>
        {label}
      </span>
    </label>
  );
}

/* JotForm-style radio option */
function JFRadio({ label, val, current, setter, name }) {
  const on = current===val;
  return (
    <label style={{
      display:"flex",alignItems:"center",gap:"10px",cursor:"pointer",
      padding:"8px 12px",borderRadius:"3px",marginBottom:"4px",
      background:on?"#f0f7ff":"transparent",
      userSelect:"none",
    }}>
      <div style={{
        width:"18px",height:"18px",borderRadius:"50%",flexShrink:0,
        border:`2px solid ${on?"#1a73e8":"#b8b8b8"}`,
        background:"white",
        display:"flex",alignItems:"center",justifyContent:"center",
        transition:"all 0.12s",
      }}>
        {on && <div style={{width:"8px",height:"8px",borderRadius:"50%",background:"#1a73e8"}}/>}
      </div>
      <input type="radio" name={name} value={val} checked={on}
        onChange={()=>setter(val)} style={{position:"absolute",opacity:0,width:0,height:0}}/>
      <span style={{fontSize:"14px",color:"#2c3e50"}}>{label}</span>
    </label>
  );
}

/* Calculation read-only field */
function CalcField({ label, value, hi, warn }) {
  return (
    <div style={{marginBottom:"16px"}}>
      <label style={{fontSize:"15px",fontWeight:"700",color:"#2c3e50",display:"block",marginBottom:"6px"}}>
        {label}
      </label>
      <div style={{
        height:"38px",border:`1px solid ${hi?"#86efac":warn?"#fed7aa":"#b8b8b8"}`,
        borderRadius:"4px",padding:"0 12px",fontSize:"14px",
        background:hi?"#f0fdf4":warn?"#fff7ed":"#f9f9f9",
        color:hi?"#15803d":warn?"#c2410c":"#2c3e50",
        fontWeight:"600",display:"flex",alignItems:"center",
      }}>
        {value}
      </div>
    </div>
  );
}

/* Signature pad placeholder */
function SignaturePad({ label }) {
  return (
    <div style={{marginBottom:"20px"}}>
      <label style={{fontSize:"15px",fontWeight:"700",color:"#2c3e50",display:"block",marginBottom:"6px"}}>
        {label}<span style={{color:"#ff3b3b",marginLeft:"3px"}}>*</span>
      </label>
      <div style={{
        border:"1px solid #b8b8b8",borderRadius:"4px",
        background:"white",padding:"12px",
      }}>
        <div style={{
          border:"1px dashed #d0d0d0",borderRadius:"4px",
          height:"100px",display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:"6px",
          background:"#fafafa",color:"#aaa",
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
          <span style={{fontSize:"13px",color:"#bbb",fontStyle:"italic"}}>Sign Here (Training Mode)</span>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:"8px"}}>
          <button style={{
            padding:"4px 14px",fontSize:"12px",color:"#666",border:"1px solid #ddd",
            borderRadius:"3px",background:"white",cursor:"pointer",
          }}>Clear</button>
        </div>
        <div style={{fontSize:"11px",color:"#999",marginTop:"4px",textAlign:"center"}}>
          Powered by <span style={{color:"#1a73e8"}}>Jotform Sign</span>
        </div>
      </div>
    </div>
  );
}

/* Break pair entry */
function BreakEntry({ index, b, onChangeStart, onChangeEnd, showTips, isSleep }) {
  const n = index + 1;
  const dur = validPair(b) ? spanMin(b.start,b.end) : 0;
  return (
    <div style={{
      marginBottom:"20px",padding:"14px 16px",
      background:isSleep?"#f0f9ff":"#fafafa",
      border:`1px solid ${isSleep?"#93c5fd":"#e8e8e8"}`,
      borderRadius:"4px",
    }}>
      <div style={{
        fontSize:"13px",fontWeight:"700",color:isSleep?"#1d4ed8":"#888",
        textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"12px",
        display:"flex",alignItems:"center",gap:"8px",
      }}>
        Break {n}
        {isSleep && (
          <span style={{
            background:"#dbeafe",color:"#1d4ed8",borderRadius:"3px",
            padding:"1px 8px",fontSize:"10px",fontWeight:"700",letterSpacing:"0.04em",
          }}>SLEEP PERIOD</span>
        )}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
        <div>
          <div style={{fontSize:"13px",color:"#666",marginBottom:"5px",fontWeight:"600"}}>Start</div>
          <JFTime value={b.start} onChange={onChangeStart} id={`brk-${n}-s`}/>
        </div>
        <div>
          <div style={{fontSize:"13px",color:"#666",marginBottom:"5px",fontWeight:"600"}}>End</div>
          <JFTime value={b.end} onChange={onChangeEnd} id={`brk-${n}-e`}/>
        </div>
      </div>
      {dur > 0 && (
        <div style={{
          marginTop:"8px",fontSize:"12.5px",
          color:isSleep?"#1d4ed8":"#555",fontWeight:"600",
        }}>
          Duration: {fmtH(dur)}
        </div>
      )}
    </div>
  );
}

/* Interruption pair entry */
function IntEntry({ index, b, onChangeStart, onChangeEnd }) {
  const dur = validPair(b) ? spanMin(b.start,b.end) : 0;
  return (
    <div style={{
      marginBottom:"16px",padding:"14px 16px",
      background:"#fdf4ff",border:"1px solid #d8b4fe",borderRadius:"4px",
    }}>
      <div style={{fontSize:"13px",fontWeight:"700",color:"#7e22ce",
        textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"12px"}}>
        Interruption {index+1}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
        <div>
          <div style={{fontSize:"13px",color:"#666",marginBottom:"5px",fontWeight:"600"}}>Start</div>
          <JFTime value={b.start} onChange={onChangeStart} id={`int-${index}-s`}/>
        </div>
        <div>
          <div style={{fontSize:"13px",color:"#666",marginBottom:"5px",fontWeight:"600"}}>End</div>
          <JFTime value={b.end} onChange={onChangeEnd} id={`int-${index}-e`}/>
        </div>
      </div>
      {dur > 0 && (
        <div style={{marginTop:"8px",fontSize:"12.5px",color:"#7e22ce",fontWeight:"700"}}>
          + {fmtH(dur)} paid interruption time
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   MAIN COMPONENT
────────────────────────────────────────────────────────── */
export default function TimesheetTrainer() {
  const [showTips, setShowTips] = useState(true);
  const [scenarioLoaded, setScenarioLoaded] = useState(false);
  const [validated, setValidated] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [vMonth,  setVMonth]  = useState("");
  const [vDay,    setVDay]    = useState("");
  const [vYear,   setVYear]   = useState("");
  const [empId,   setEmpId]   = useState("");
  const [empFirst,setEmpFirst]= useState("");
  const [empLast, setEmpLast] = useState("");
  const [empEmail,setEmpEmail]= useState("");
  const [cliFirst,setCliFirst]= useState("");
  const [cliLast, setCliLast] = useState("");
  const [addrStr, setAddrStr] = useState("");
  const [addrStr2,setAddrStr2]= useState("");
  const [addrCity,setAddrCity]= useState("");
  const [addrSt,  setAddrSt]  = useState("");
  const [addrZip, setAddrZip] = useState("");
  const [schedHrs,setSchedHrs]= useState("");
  const [tasks,   setTasks]   = useState(new Set());
  const [begin,   setBegin]   = useState(defT());
  const [end,     setEnd]     = useState(defT());
  const [breaks,  setBreaks]  = useState(Array.from({length:6},defP));
  const [addMore, setAddMore] = useState("no");
  const [xBreaks, setXBreaks] = useState(Array.from({length:6},defP));
  const [hasInt,  setHasInt]  = useState("no");
  const [ints,    setInts]    = useState(Array.from({length:6},defP));
  const [intNotes,setIntNotes]= useState("");
  const [gotSleep,setGotSleep]= useState("");
  const [cliSign, setCliSign] = useState("");
  const [firstLast,setFirstLast]=useState("");

  /* Pair updater — properly curried */
  const updPair = useCallback((setter, i, side) => v =>
    setter(p => p.map((b,idx) => idx===i ? {...b,[side]:v} : b))
  , []);

  /* Load scenario */
  const loadScenario = () => {
    const s = SCENARIO;
    setVMonth(s.visitDate.month); setVDay(s.visitDate.day); setVYear(s.visitDate.year);
    setEmpId(s.empId); setEmpFirst(s.empFirst); setEmpLast(s.empLast); setEmpEmail(s.empEmail);
    setCliFirst(s.cliFirst); setCliLast(s.cliLast);
    setAddrStr(s.street); setAddrStr2(s.street2); setAddrCity(s.city);
    setAddrSt(s.state); setAddrZip(s.zip);
    setSchedHrs(s.scheduledHours); setTasks(new Set(s.tasks));
    setBegin({...s.begin}); setEnd({...s.end});
    setBreaks(s.breaks.map(b=>({start:{...b.start},end:{...b.end}})));
    setAddMore(s.addMore);
    setXBreaks(s.extraBreaks.map(b=>({start:{...b.start},end:{...b.end}})));
    setHasInt(s.hasInt);
    setInts(s.interruptions.map(b=>({start:{...b.start},end:{...b.end}})));
    setIntNotes(s.intNotes); setGotSleep(s.gotSleep); setCliSign(s.clientCanSign);
    setFirstLast("no");
    setScenarioLoaded(true); setValidated(false); setSuccess(false);
    setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),50);
  };

  const resetAll = () => {
    setVMonth(""); setVDay(""); setVYear("");
    setEmpId(""); setEmpFirst(""); setEmpLast(""); setEmpEmail("");
    setCliFirst(""); setCliLast(""); setAddrStr(""); setAddrStr2("");
    setAddrCity(""); setAddrSt(""); setAddrZip("");
    setSchedHrs(""); setTasks(new Set());
    setBegin(defT()); setEnd(defT());
    setBreaks(Array.from({length:6},defP)); setAddMore("no");
    setXBreaks(Array.from({length:6},defP));
    setHasInt("no"); setInts(Array.from({length:6},defP));
    setIntNotes(""); setGotSleep(""); setCliSign(""); setFirstLast("");
    setScenarioLoaded(false); setValidated(false); setSuccess(false);
  };

  /* Calculations */
  const calcs = useMemo(() => {
    const all = [...breaks,...(addMore==="yes"?xBreaks:[])];
    const brkM  = all.reduce((s,b) => s+(validPair(b)?spanMin(b.start,b.end):0), 0);
    const intM  = hasInt==="yes" ? ints.reduce((s,b)=>s+(validPair(b)?spanMin(b.start,b.end):0),0) : 0;
    const shiftM = spanMin(begin,end);
    const onDutyM = Math.max(0, shiftM - brkM + intM);
    const sleepM  = all.reduce((mx,b)=>{ const d=validPair(b)?spanMin(b.start,b.end):0; return d>mx?d:mx; },0);
    const unpaidSleepM = Math.max(0, sleepM - intM);
    return { shiftM, brkM, intM, onDutyM, sleepM, unpaidSleepM, paidSleepM:intM,
      otherBrkM:Math.max(0,brkM-sleepM) };
  }, [begin,end,breaks,addMore,xBreaks,hasInt,ints]);

  /* Validation */
  const errors = useMemo(() => {
    const e=[];
    if(!empFirst||!empLast) e.push("Employee name is required.");
    if(!empId)              e.push("Employee ID is required.");
    if(!cliFirst||!cliLast) e.push("Client name is required.");
    if(!schedHrs)           e.push("Hours scheduled per day (LOA) must be selected.");
    if(tasks.size===0)      e.push("At least one Daily Task must be checked.");
    if(!toMin(begin))       e.push("BEGIN Client Care time is required.");
    if(!toMin(end))         e.push("END Client Care time is required.");
    // END is a PM time (client put to sleep), so span is ~10-15 hrs of active duty
    if(toMin(begin)!==null&&toMin(end)!==null&&(calcs.shiftM<4*60||calcs.shiftM>18*60))
      e.push(`Active duty span = ${fmtH(calcs.shiftM)} — seems outside normal range. Check your Begin/End times & AM/PM.`);
    if(!gotSleep)  e.push("'Did you receive 5 hours of uninterrupted sleep?' must be answered.");
    if(!cliSign)   e.push("'Client able to sign?' must be answered.");
    return e;
  },[empFirst,empLast,empId,cliFirst,cliLast,schedHrs,tasks,begin,end,calcs,gotSleep,cliSign]);

  const shiftOk   = toMin(begin)!==null && toMin(end)!==null;
  // END is PM (client to bed), so active duty span is typically 8–14 hours
  const shiftGood = shiftOk && calcs.shiftM >= 8*60 && calcs.shiftM <= 15*60;

  /* ── Layout ── */
  const formW = {maxWidth:"680px",margin:"0 auto"};

  return (
    <div style={{
      background:"#f3f3fe",minHeight:"100vh",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600;700;800&display=swap');
        * { box-sizing:border-box; }
        body { margin:0; }
        select:focus, input:focus, textarea:focus {
          outline:none;
          border-color:#1a73e8 !important;
          box-shadow:0 0 0 3px rgba(26,115,232,0.2) !important;
        }
        input[type=radio] { position:absolute; opacity:0; width:0; height:0; }
      `}</style>

      {/* ── Training toolbar ── */}
      <div style={{
        background:"#1a1a2e",borderBottom:"3px solid #e8513a",
        padding:"10px 16px",
      }}>
        <div style={{...formW,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"8px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{
              background:"#e8513a",borderRadius:"6px",padding:"4px 9px",
              fontWeight:"800",fontSize:"12px",color:"white",letterSpacing:"0.06em",
            }}>ALS</div>
            <div>
              <span style={{color:"white",fontWeight:"700",fontSize:"13px"}}>Training Mode</span>
              <span style={{color:"#93c5fd",fontSize:"11px",marginLeft:"8px"}}>— nothing is submitted</span>
            </div>
          </div>
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
            <Btn onClick={()=>setShowTips(t=>!t)}
              bg={showTips?"#f59e0b":"rgba(255,255,255,0.1)"}
              col={showTips?"#1a1a2e":"white"}>
              💡 Tips {showTips?"ON":"OFF"}
            </Btn>
            <Btn onClick={loadScenario} bg="rgba(255,255,255,0.1)" col="white">
              📋 Sample Scenario
            </Btn>
            <Btn onClick={resetAll} bg="rgba(239,68,68,0.2)" col="#fca5a5">
              ✕ Reset
            </Btn>
          </div>
        </div>
      </div>

      {/* ── Scenario banner ── */}
      {scenarioLoaded && (
        <div style={{background:"#d1fae5",borderBottom:"1px solid #6ee7b7",padding:"10px 16px"}}>
          <div style={{...formW,fontSize:"13px",color:"#065f46",fontWeight:"600"}}>
            ✅ Sample Scenario: Jane Smith (ID 1042) · Client Robert Johnson · 10-hr LOA · May 5 2025 |
            BEGIN 8:00 AM | END 9:00 PM (client to bed, caregiver free &amp; clear) |
            Break 1: lunch 12:30–1:00 PM | Break 2: personal break 2:17–3:45 PM |
            Interruptions: 2:00 AM (bathroom) &amp; 4:30 AM (repositioning)
          </div>
        </div>
      )}

      <div style={{padding:"24px 16px 48px"}}>
        <div style={formW}>

          {/* ── FORM HEADER ── */}
          <div style={{
            background:"white",borderRadius:"6px 6px 0 0",
            boxShadow:"0 2px 8px rgba(0,0,0,0.1)",
            overflow:"hidden",marginBottom:"0",
          }}>
            {/* Logo banner */}
            <div style={{
              background:"linear-gradient(135deg,#e8513a,#c0392b)",
              padding:"20px 24px",textAlign:"center",
            }}>
              <div style={{
                display:"inline-block",background:"white",borderRadius:"8px",
                padding:"8px 20px",marginBottom:"12px",
              }}>
                <span style={{
                  fontFamily:"'Nunito Sans',sans-serif",fontWeight:"800",
                  fontSize:"18px",color:"#e8513a",letterSpacing:"0.04em",
                }}>Assisted Living Services</span>
              </div>
              <div style={{
                fontFamily:"'Nunito Sans',sans-serif",
                fontSize:"20px",fontWeight:"800",color:"white",
                letterSpacing:"0.03em",marginBottom:"4px",
              }}>
                SERVICE &amp; TIMESHEET RECORD
              </div>
              <div style={{color:"rgba(255,255,255,0.9)",fontSize:"14px",fontStyle:"italic"}}>
                Live-In Companion Services
              </div>
            </div>

            {/* Form body */}
            <div style={{padding:"24px"}}>

              {/* AM/PM Warning Banner */}
              {showTips && (
                <div style={{
                  background:"#fff3cd",border:"1px solid #ffc107",
                  borderLeft:"4px solid #f59e0b",borderRadius:"4px",
                  padding:"10px 14px",marginBottom:"24px",
                  fontSize:"13px",color:"#664d03",display:"flex",gap:"8px",
                }}>
                  <span style={{fontSize:"16px"}}>⚠️</span>
                  <span><strong>Training Tip:</strong> {TIPS.ampm} Also: END Client Care should be a <strong>PM time</strong> (when client goes to sleep) — not the following morning.</span>
                </div>
              )}

              {/* ── Visit Date ── */}
              <JFField label="Visit Date" required tip={TIPS.visitDate} showTips={showTips}>
                <div style={{display:"flex",gap:"8px"}}>
                  <JFSelect value={vMonth} onChange={setVMonth} style={{flex:2}}>
                    <option value="">-Month</option>
                    {MONTHS.map((m,i)=><option key={i} value={String(i+1)}>{m}</option>)}
                  </JFSelect>
                  <JFSelect value={vDay} onChange={setVDay} style={{flex:1}}>
                    <option value="">-Day</option>
                    {Array.from({length:31},(_,i)=><option key={i+1} value={String(i+1)}>{i+1}</option>)}
                  </JFSelect>
                  <JFSelect value={vYear} onChange={setVYear} style={{flex:1}}>
                    <option value="">Year</option>
                    {["2025","2026"].map(y=><option key={y} value={y}>{y}</option>)}
                  </JFSelect>
                </div>
              </JFField>

              {/* ── Employee ID ── */}
              <JFField label="Employee ID:" required tip={TIPS.empId} showTips={showTips}>
                <JFInput value={empId} onChange={setEmpId} placeholder="Employee ID" style={{maxWidth:"200px"}}/>
              </JFField>

              {/* ── Employee Name ── */}
              <JFField label="Employee Name" required>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
                  <div>
                    <JFInput value={empFirst} onChange={setEmpFirst} placeholder="First Name"/>
                    <div style={{fontSize:"11px",color:"#999",marginTop:"3px"}}>First Name</div>
                  </div>
                  <div>
                    <JFInput value={empLast} onChange={setEmpLast} placeholder="Last Name"/>
                    <div style={{fontSize:"11px",color:"#999",marginTop:"3px"}}>Last Name</div>
                  </div>
                </div>
              </JFField>

              {/* ── Employee Email ── */}
              <JFField label="Employee Email" required>
                <JFInput value={empEmail} onChange={setEmpEmail} placeholder="example@example.com" type="email"/>
              </JFField>

              {/* ── Client Name ── */}
              <JFField label="Client Name" required>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
                  <div>
                    <JFInput value={cliFirst} onChange={setCliFirst} placeholder="First Name"/>
                    <div style={{fontSize:"11px",color:"#999",marginTop:"3px"}}>First Name</div>
                  </div>
                  <div>
                    <JFInput value={cliLast} onChange={setCliLast} placeholder="Last Name"/>
                    <div style={{fontSize:"11px",color:"#999",marginTop:"3px"}}>Last Name</div>
                  </div>
                </div>
              </JFField>

              {/* ── Client Address ── */}
              <JFField label="Client Address">
                <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                  <JFInput value={addrStr} onChange={setAddrStr} placeholder="Street Address"/>
                  <JFInput value={addrStr2} onChange={setAddrStr2} placeholder="Street Address Line 2"/>
                  <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"8px"}}>
                    <div>
                      <JFInput value={addrCity} onChange={setAddrCity} placeholder="City"/>
                      <div style={{fontSize:"11px",color:"#999",marginTop:"3px"}}>City</div>
                    </div>
                    <div>
                      <JFSelect value={addrSt} onChange={setAddrSt}>
                        <option value="">State</option>
                        {US_STATES.map(s=><option key={s} value={s}>{s}</option>)}
                      </JFSelect>
                      <div style={{fontSize:"11px",color:"#999",marginTop:"3px"}}>State / Province</div>
                    </div>
                    <div>
                      <JFInput value={addrZip} onChange={setAddrZip} placeholder="Zip"/>
                      <div style={{fontSize:"11px",color:"#999",marginTop:"3px"}}>Postal / Zip Code</div>
                    </div>
                  </div>
                </div>
              </JFField>

              {/* ── Hours scheduled per day ── */}
              <JFField
                label="Hours scheduled per day as confirmed on the Letter of Assignment for this case"
                required tip={TIPS.scheduledHours} showTips={showTips}>
                <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                  {["10","11","12"].map(h=>(
                    <JFRadio key={h} label={`${h} Hours`} val={h}
                      current={schedHrs} setter={setSchedHrs} name="schedhrs"/>
                  ))}
                </div>
              </JFField>

              {/* ── Daily Tasks ── */}
              <JFField label="Daily Tasks" required tip={TIPS.dailyTasks} showTips={showTips}>
                <div style={{
                  border:"1px solid #e8e8e8",borderRadius:"4px",
                  background:"#fafafa",overflow:"hidden",
                }}>
                  {TASKS.map((t,i)=>(
                    <div key={t.code} style={{borderBottom:i<TASKS.length-1?"1px solid #f0f0f0":"none"}}>
                      <JFCheckbox
                        code={t.code} label={t.label}
                        checked={tasks.has(t.code)}
                        onChange={()=>setTasks(prev=>{
                          const n=new Set(prev);
                          n.has(t.code)?n.delete(t.code):n.add(t.code);
                          return n;
                        })}
                      />
                    </div>
                  ))}
                </div>
                <div style={{marginTop:"6px",fontSize:"12px",color:"#888",fontStyle:"italic"}}>
                  {tasks.size} of {TASKS.length} tasks selected
                </div>
              </JFField>

              {/* ── BEGIN Client Care ── */}
              <JFField label="BEGIN Client Care (on duty)" required tip={TIPS.begin} showTips={showTips}>
                <JFTime value={begin} onChange={setBegin}/>
              </JFField>

              {/* ── END Client Care ── */}
              <JFField label="END Client Care (off duty)" required tip={TIPS.end} showTips={showTips}>
                <JFTime value={end} onChange={setEnd}/>
                {shiftOk && (
                  <div style={{
                    marginTop:"8px",padding:"8px 12px",borderRadius:"4px",
                    background:shiftGood?"#d1fae5":"#fff7ed",
                    border:`1px solid ${shiftGood?"#6ee7b7":"#fed7aa"}`,
                    fontSize:"13px",fontWeight:"600",
                    color:shiftGood?"#065f46":"#9a3412",
                  }}>
                    {shiftGood
                      ? `✓ Active duty: ${fmtH(calcs.shiftM)} — looks correct (BEGIN AM → END PM when client to bed)`
                      : `⚠ Active duty span: ${fmtH(calcs.shiftM)} — END should be a PM time when client goes to sleep. Check AM/PM.`}
                  </div>
                )}
              </JFField>

              {/* ── Breaks 1–6 ── */}
              <JFSectionHeader label="Off-Duty Breaks" sub="Meals, personal time, and sleep period"/>
              {showTips && (
                <div style={{
                  background:"#fff8e1",border:"1px solid #ffe082",
                  borderLeft:"3px solid #f59e0b",borderRadius:"4px",
                  padding:"10px 14px",marginBottom:"16px",
                  fontSize:"12.5px",color:"#6d4c00",lineHeight:"1.5",
                }}>
                  💡 {TIPS.breaks}<br/><br/>
                  🛌 {TIPS.sleepBreak}
                </div>
              )}
              {breaks.map((b,i)=>(
                <BreakEntry key={i} index={i} b={b}
                  isSleep={scenarioLoaded && i===1 && validPair(b)}
                  showTips={showTips}
                  onChangeStart={updPair(setBreaks,i,"start")}
                  onChangeEnd={updPair(setBreaks,i,"end")}
                />
              ))}

              {/* ── Add more breaks ── */}
              <JFField label="Add more Breaks?" required>
                <div style={{display:"flex",gap:"16px"}}>
                  <JFRadio label="Yes" val="yes" current={addMore} setter={setAddMore} name="addmore"/>
                  <JFRadio label="No"  val="no"  current={addMore} setter={setAddMore} name="addmore"/>
                </div>
              </JFField>

              {addMore==="yes" && xBreaks.map((b,i)=>(
                <BreakEntry key={i} index={i+6} b={b}
                  showTips={false}
                  onChangeStart={updPair(setXBreaks,i,"start")}
                  onChangeEnd={updPair(setXBreaks,i,"end")}
                />
              ))}

              {/* ── Sleep interruptions ── */}
              <JFSectionHeader label="Sleep Interruptions" sub="Times woken during sleep to provide care"/>
              <JFField label="Were there any interruptions during your sleep?" required>
                <div style={{display:"flex",gap:"16px"}}>
                  <JFRadio label="Yes" val="yes" current={hasInt} setter={setHasInt} name="hasint"/>
                  <JFRadio label="No"  val="no"  current={hasInt} setter={setHasInt} name="hasint"/>
                </div>
                {showTips && (
                  <div style={{
                    marginTop:"8px",padding:"8px 12px",
                    background:"#fff8e1",border:"1px solid #ffe082",
                    borderLeft:"3px solid #f59e0b",borderRadius:"4px",
                    fontSize:"12.5px",color:"#6d4c00",lineHeight:"1.5",
                  }}>💡 {TIPS.interruptions}</div>
                )}
              </JFField>

              {hasInt==="yes" && (
                <>
                  {ints.map((b,i)=>(
                    <IntEntry key={i} index={i} b={b}
                      onChangeStart={updPair(setInts,i,"start")}
                      onChangeEnd={updPair(setInts,i,"end")}
                    />
                  ))}
                  <JFField label="Interruption Notes/Details:">
                    <textarea value={intNotes} onChange={e=>setIntNotes(e.target.value)} rows={4}
                      placeholder="Describe what care was provided during each interruption (e.g., 'Client needed bathroom assistance at 3 AM, assisted with transfer to and from bathroom')"
                      style={{
                        width:"100%",border:"1px solid #b8b8b8",borderRadius:"4px",
                        padding:"10px 12px",fontSize:"14px",background:"white",
                        color:"#2c3e50",fontFamily:"inherit",outline:"none",resize:"vertical",
                      }}/>
                  </JFField>
                </>
              )}

              {/* ── 5-hour sleep question ── */}
              <JFField label="Did you receive 5 hours of uninterrupted sleep?" required tip={TIPS.sleep5} showTips={showTips}>
                <div style={{display:"flex",gap:"16px"}}>
                  <JFRadio label="Yes" val="yes" current={gotSleep} setter={setGotSleep} name="gotsleep"/>
                  <JFRadio label="No"  val="no"  current={gotSleep} setter={setGotSleep} name="gotsleep"/>
                </div>
                {gotSleep==="no" && (
                  <div style={{
                    marginTop:"10px",padding:"12px 14px",
                    background:"#fef2f2",border:"1px solid #fca5a5",
                    borderLeft:"4px solid #ef4444",borderRadius:"4px",
                  }}>
                    <div style={{fontWeight:"700",color:"#991b1b",fontSize:"14px"}}>
                      📞 Please call your Scheduling Manager for a support solution
                    </div>
                    <div style={{color:"#b91c1c",fontSize:"12px",marginTop:"4px"}}>
                      Do not submit this timesheet without first speaking with your manager.
                    </div>
                  </div>
                )}
              </JFField>

              {/* ── Please review note ── */}
              <div style={{
                background:"#fffbeb",border:"1px solid #f59e0b",
                borderRadius:"4px",padding:"10px 14px",marginBottom:"20px",
                fontSize:"13px",color:"#92400e",fontWeight:"600",
              }}>
                ★ <strong>Please review all times you input above and confirm AM or PM before submitting your timesheet.</strong>
              </div>

              {/* ── Calculated Fields ── */}
              <JFSectionHeader label="Calculated Hours" sub="Auto-computed from your entries above"/>
              {showTips && (
                <div style={{
                  background:"#fff8e1",border:"1px solid #ffe082",
                  borderLeft:"3px solid #f59e0b",borderRadius:"4px",
                  padding:"10px 14px",marginBottom:"16px",
                  fontSize:"12.5px",color:"#6d4c00",
                }}>💡 {TIPS.calcs}</div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
                <CalcField label="Total Unpaid Hours (Off Duty)" value={fmtH(calcs.brkM)}/>
                <CalcField label="Unpaid Sleep Hours" value={fmtH(calcs.unpaidSleepM)}/>
                <CalcField label="Paid Sleep Hours" value={fmtH(calcs.paidSleepM)} hi={calcs.paidSleepM>0}/>
                <CalcField label="Total Interruption Time" value={fmtH(calcs.intM)} hi={calcs.intM>0}/>
                <CalcField label="Total Hours (On Duty)" value={fmtH(calcs.onDutyM)}/>
                <CalcField
                  label="Total Hours Worked"
                  value={fmtH(calcs.onDutyM)}
                  hi={calcs.onDutyM>0&&(!schedHrs||calcs.onDutyM<=parseInt(schedHrs||12)*60+30)}
                  warn={!!schedHrs&&calcs.onDutyM>parseInt(schedHrs)*60+30}
                />
              </div>
              {schedHrs && calcs.onDutyM>0 && (
                <div style={{
                  padding:"10px 14px",background:"#f0f9ff",border:"1px solid #bae6fd",
                  borderRadius:"4px",fontSize:"13px",color:"#0369a1",marginBottom:"20px",
                }}>
                  LOA scheduled: <strong>{schedHrs} hrs</strong> &nbsp;·&nbsp;
                  Calculated worked: <strong>{fmtH(calcs.onDutyM)}</strong>
                  {calcs.intM>0&&` (includes ${fmtH(calcs.intM)} paid interruption time)`}
                </div>
              )}

              {/* ── Signatures ── */}
              <JFSectionHeader label="Signatures"/>
              <SignaturePad label="Caregiver Signature"/>
              <SignaturePad label="Client Signature"/>

              <JFField label="Client able to sign?" required>
                <div style={{display:"flex",gap:"16px"}}>
                  <JFRadio label="Yes" val="yes" current={cliSign} setter={setCliSign} name="clisign"/>
                  <JFRadio label="No"  val="no"  current={cliSign} setter={setCliSign} name="clisign"/>
                </div>
              </JFField>

              <JFField label="Is this the first day or the last day on this client?" required>
                <div style={{display:"flex",gap:"16px"}}>
                  <JFRadio label="Yes" val="yes" current={firstLast} setter={setFirstLast} name="firstlast"/>
                  <JFRadio label="No"  val="no"  current={firstLast} setter={setFirstLast} name="firstlast"/>
                </div>
                <div style={{
                  marginTop:"12px",background:"#fff8e1",border:"1px solid #ffe082",
                  borderLeft:"3px solid #f59e0b",borderRadius:"4px",
                  padding:"12px 14px",fontSize:"13px",color:"#6d4c00",lineHeight:"1.65",
                }}>
                  <div style={{fontWeight:"700",marginBottom:"6px"}}>
                    💡 Why this question matters — Partial Day Hours
                  </div>
                  <div style={{marginBottom:"8px"}}>
                    This question helps calculate accurate hours for caregivers who work fewer
                    hours than their Visit Type hours on their LOA (a partial day).
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                    <div style={{background:"rgba(255,255,255,0.6)",borderRadius:"3px",padding:"8px 10px"}}>
                      <strong style={{color:"#e65100"}}>Answer NO</strong>
                      {" — If you worked less than your Visit Type hours and this is not the first or last day on this client, your hours for that day will be "}
                      <strong>rounded up to the full Visit Type hours.</strong>
                    </div>
                    <div style={{background:"rgba(255,255,255,0.6)",borderRadius:"3px",padding:"8px 10px"}}>
                      <strong style={{color:"#1565c0"}}>Answer YES</strong>
                      {" — If you worked less than your Visit Type hours and this is the first or last day on this client, your hours will "}
                      <strong>remain as entered — no rounding up.</strong>
                    </div>
                  </div>
                </div>
              </JFField>

              {/* ── Validation errors ── */}
              {validated && errors.length>0 && (
                <div style={{
                  background:"#fef2f2",border:"1px solid #fca5a5",
                  borderRadius:"4px",padding:"14px 16px",marginBottom:"16px",
                }}>
                  <div style={{fontWeight:"700",color:"#991b1b",marginBottom:"10px",fontSize:"14px"}}>
                    ❌ {errors.length} issue{errors.length!==1?"s":""} to fix before submitting:
                  </div>
                  {errors.map((e,i)=>(
                    <div key={i} style={{display:"flex",gap:"8px",marginBottom:"5px",
                      fontSize:"13px",color:"#b91c1c"}}>
                      <span>•</span><span>{e}</span>
                    </div>
                  ))}
                </div>
              )}

              {success && (
                <div style={{
                  background:"#d1fae5",border:"1px solid #6ee7b7",
                  borderRadius:"4px",padding:"16px",marginBottom:"16px",textAlign:"center",
                }}>
                  <div style={{fontSize:"28px",marginBottom:"6px"}}>🎉</div>
                  <div style={{fontWeight:"800",color:"#065f46",fontSize:"16px"}}>Training Complete!</div>
                  <div style={{color:"#047857",fontSize:"13px",marginTop:"4px"}}>
                    All required fields filled correctly. In the real JotForm, this would submit to your manager for payroll processing.
                  </div>
                </div>
              )}

              {/* ── Navigation buttons (exact JotForm style) ── */}
              <div style={{
                borderTop:"1px solid #e8e8e8",paddingTop:"20px",
                display:"flex",alignItems:"center",justifyContent:"space-between",
                flexWrap:"wrap",gap:"10px",
              }}>
                <div style={{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}}>
                  <button style={{
                    padding:"10px 28px",border:"1px solid #e8513a",borderRadius:"4px",
                    background:"white",color:"#e8513a",fontSize:"14px",fontWeight:"700",
                    fontFamily:"inherit",cursor:"pointer",
                  }}>Back</button>
                  <button
                    onClick={()=>{setValidated(true);setSuccess(errors.length===0);}}
                    style={{
                      padding:"10px 32px",border:"none",borderRadius:"4px",
                      background:"linear-gradient(135deg,#e8513a,#c0392b)",
                      color:"white",fontSize:"14px",fontWeight:"700",
                      fontFamily:"inherit",cursor:"pointer",
                      boxShadow:"0 2px 8px rgba(232,81,58,0.4)",
                    }}>
                    {validated&&errors.length===0?"Submit ✓":"Next"}
                  </button>
                </div>
                <button style={{
                  padding:"10px 16px",border:"none",borderRadius:"4px",
                  background:"transparent",color:"#888",fontSize:"13px",
                  fontFamily:"inherit",cursor:"pointer",textDecoration:"underline",
                }}>Save and Continue Later</button>
              </div>

            </div>{/* /form body */}
          </div>{/* /form card */}

          {/* ── Training cheat sheet ── */}
          {showTips && (
            <div style={{
              marginTop:"16px",background:"#1a1a2e",borderRadius:"6px",
              padding:"20px",boxShadow:"0 2px 8px rgba(0,0,0,0.2)",
            }}>
              <div style={{
                fontWeight:"800",color:"white",fontSize:"16px",
                marginBottom:"14px",borderBottom:"1px solid rgba(255,255,255,0.1)",
                paddingBottom:"10px",
              }}>
                📚 Top 6 Common Mistakes to Avoid
              </div>
              {[
                ["⚠️ Wrong AM/PM","Most common error. 10 PM entered as 10 AM = 12-hour payroll error."],
                ["⚠️ Missing sleep break","The 8–10 hr sleep period MUST be logged as a break, just like meals."],
                ["⚠️ Wrong LOA hours","Select 10, 11, or 12 per your Letter of Assignment — NOT 24 hours."],
                ["⚠️ Incomplete task list","Check every task performed. Under-documenting violates the care plan."],
                ["⚠️ No interruption notes","If woken during sleep, describe the care provided — required by compliance."],
                ["⚠️ Wrong visit date","Use the morning START date. END is a PM time same day — not the next morning."],
              ].map(([title,desc],i)=>(
                <div key={i} style={{
                  display:"flex",gap:"12px",marginBottom:"8px",
                  background:"rgba(255,255,255,0.06)",borderRadius:"4px",
                  padding:"10px 12px",
                }}>
                  <span style={{fontSize:"12px",fontWeight:"700",color:"#fbbf24",
                    flexShrink:0,minWidth:"120px"}}>{title}</span>
                  <span style={{fontSize:"12px",color:"#bfdbfe",lineHeight:1.5}}>{desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* JotForm footer */}
          <div style={{textAlign:"center",marginTop:"16px",fontSize:"12px",color:"#aaa"}}>
            <a href="https://www.jotform.com" target="_blank" rel="noreferrer"
              style={{color:"#1a73e8",textDecoration:"none",fontWeight:"600"}}>
              Powered by Jotform
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Small utility button */
function Btn({onClick, bg, col, children}) {
  return (
    <button onClick={onClick} style={{
      background:bg,border:"1px solid rgba(255,255,255,0.15)",borderRadius:"16px",
      padding:"5px 12px",color:col,fontWeight:"600",fontSize:"11.5px",
      fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap",
    }}>{children}</button>
  );
}
