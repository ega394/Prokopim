import { useState, useRef } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ROLE_GROUPS = [
  { group:"Pimpinan", roles:[
    { key:"walikota",      label:"Wali Kota",                    icon:"🔵", desc:"Lihat jadwal & konfirmasi kehadiran" },
    { key:"wakilwalikota", label:"Wakil Wali Kota",               icon:"🟢", desc:"Lihat jadwal & konfirmasi kehadiran" },
  ]},
  { group:"Tim Pendukung", roles:[
    { key:"ajudan",   label:"Ajudan",                            icon:"📋", desc:"Lihat agenda & simpan ke kalender" },
    { key:"timkom",   label:"Tim Komunikasi & Dokumentasi",       icon:"📎", desc:"Upload sambutan & dokumentasi" },
    { key:"staf",     label:"Staf Protokol",                     icon:"✏️", desc:"Input jadwal & analisa undangan" },
    { key:"kasubbag", label:"Kasubbag Protokol",                 icon:"🔍", desc:"Verifikasi jadwal" },
    { key:"kabag",    label:"Kabag",                             icon:"✅", desc:"Persetujuan final" },
  ]}
];
const ALL_ROLES = ROLE_GROUPS.flatMap(g => g.roles);
const WF = {
  draft:             { label:"Draft",              color:"#64748b", bg:"#f1f5f9" },
  menunggu_kasubbag: { label:"Menunggu Kasubbag",  color:"#d97706", bg:"#fef3c7" },
  menunggu_kabag:    { label:"Menunggu Kabag",      color:"#7c3aed", bg:"#ede9fe" },
  disetujui:         { label:"Disetujui ✓",         color:"#065f46", bg:"#d1fae5" },
  ditolak:           { label:"Ditolak",             color:"#991b1b", bg:"#fee2e2" },
};
const PAKAIAN = ["PDH","PDH Batik Tarakan","Batik Lengan Panjang","PSL","PSR","PSH","PDUB","Pakaian Lapangan","Pakaian Olahraga","Bebas Rapi"];
const JENIS   = ["Menghadiri","Sambutan","Pengarahan"];
const PEJABAT = ["Sekda","Asisten Pemerintahan dan Kesra","Asisten Perekonomian dan Pembangunan","Asisten Administrasi Umum"];

// ─── USER ACCOUNTS ────────────────────────────────────────────────────────────
const USERS = [
  { username:"walikota",      password:"WK@2025",      role:"walikota",      nama:"Wali Kota Tarakan",                      jabatan:"Wali Kota Tarakan" },
  { username:"wakilwalikota", password:"WWK@2025",     role:"wakilwalikota", nama:"Wakil Wali Kota Tarakan",                jabatan:"Wakil Wali Kota Tarakan" },
  { username:"ajudan",        password:"Ajudan@2025",  role:"ajudan",        nama:"Ajudan Pimpinan",                        jabatan:"Ajudan" },
  { username:"timkom",        password:"Timkom@2025",  role:"timkom",        nama:"Tim Komunikasi & Dokumentasi",           jabatan:"Tim Komunikasi & Dokumentasi Pimpinan" },
  { username:"staf",          password:"Staf@2025",    role:"staf",          nama:"Staf Protokol",                          jabatan:"Staf Protokol" },
  { username:"kasubbag",      password:"Ksbg@2025",    role:"kasubbag",      nama:"Kasubbag Protokol",                      jabatan:"Kasubbag Protokol" },
  { username:"kabag",         password:"Kabag@2025",   role:"kabag",         nama:"Kabag Protokol & Komunikasi",            jabatan:"Kepala Bagian Protokol & Komunikasi Pimpinan" },
];


// ─── HELPERS ──────────────────────────────────────────────────────────────────
const HARI_ID = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const getHari   = d => d ? HARI_ID[new Date(d+"T00:00:00").getDay()] : "";
const fmt       = d => d ? new Date(d+"T00:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"}) : "—";
const fmtShort  = d => d ? new Date(d+"T00:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}) : "—";
const toMin     = t => { if(!t) return 0; const[h,m]=t.split(":").map(Number); return h*60+m; };
const todayStr  = () => new Date().toISOString().slice(0,10);
const tomorrowStr=()=>{ const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); };
const weekStart = ()=>{ const d=new Date(); d.setDate(d.getDate()-d.getDay()+1); return d.toISOString().slice(0,10); };
const weekEnd   = ()=>{ const d=new Date(); d.setDate(d.getDate()-d.getDay()+7); return d.toISOString().slice(0,10); };
const monthStart= ()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; };
const monthEnd  = ()=>{ const d=new Date(); return new Date(d.getFullYear(),d.getMonth()+1,0).toISOString().slice(0,10); };
const hasConflict=(events,ev)=>{
  const s=toMin(ev.jam), e2=s+120;
  return events.some(e=>e.id!==ev.id&&e.alur==="disetujui"&&e.tanggal===ev.tanggal&&
    e.untukPimpinan.some(p=>ev.untukPimpinan?.includes(p))&&
    (()=>{const es=toMin(e.jam),ee=es+120;return s<ee&&e2>es;})());
};
function makeICS(ev){
  const[y,m,d]=ev.tanggal.split("-");const[hh,mm]=ev.jam.split(":");
  const p=n=>String(n).padStart(2,"0");
  const ds=`${y}${m}${d}T${p(hh)}${p(mm)}00`;
  const de=`${y}${m}${d}T${p(parseInt(hh)+2)}${p(mm)}00`;
  return"data:text/calendar;charset=utf8,"+encodeURIComponent(
    ["BEGIN:VCALENDAR","VERSION:2.0","BEGIN:VEVENT",`UID:ev${ev.id}@protokol`,
     `DTSTART:${ds}`,`DTEND:${de}`,`SUMMARY:${ev.namaAcara}`,
     `DESCRIPTION:${ev.penyelenggara}\\nPakaian: ${ev.pakaian}`,
     "END:VEVENT","END:VCALENDAR"].join("\r\n"));
}

// ─── SEED ─────────────────────────────────────────────────────────────────────
const T=todayStr(), TMR=tomorrowStr();
const mkEv=(o)=>({alur:"disetujui",catatanTolak:"",statusWK:null,statusWWK:null,
  perwakilanWK:"",perwakilanWWK:"",delegasiKeWWK:false,sambutanFile:null,sambutanNama:"",
  catatanPimpinan:"",tersembunyi:false,alurHapus:null,...o});
const seed=[
  mkEv({id:1,tanggal:T,jam:"09:00",namaAcara:"Rapat Koordinasi Infrastruktur",penyelenggara:"Dinas PUPR",
    kontak:"Budi – 0812-3456-7890",buktiUndangan:"No.045/PUPR/2025",pakaian:"PDH",
    jenisKegiatan:"Sambutan",catatan:"Ruang Rapat Lt.3 Balaikota",untukPimpinan:["walikota","wakilwalikota"]}),
  mkEv({id:2,tanggal:T,jam:"14:00",namaAcara:"Peresmian Taman Kota Baru",penyelenggara:"Dinas LH",
    kontak:"Sari – 0813-9876-5432",buktiUndangan:"No.023/DLH/2025",pakaian:"Batik Korpri",
    jenisKegiatan:"Sambutan",catatan:"Outdoor, bawa payung.",untukPimpinan:["walikota"],statusWK:"hadir"}),
  mkEv({id:3,tanggal:TMR,jam:"10:00",namaAcara:"Audiensi DPRD – Pembahasan APBD",penyelenggara:"Sekretariat DPRD",
    kontak:"Ahmad – 0811-2222-3333",buktiUndangan:"No.110/DPRD/2025",pakaian:"Jas",
    jenisKegiatan:"Pengarahan",catatan:"Bawa dokumen APBD",untukPimpinan:["walikota","wakilwalikota"],alur:"menunggu_kasubbag"}),
  mkEv({id:4,tanggal:TMR,jam:"08:00",namaAcara:"Apel Pagi Gabungan",penyelenggara:"Sekretariat Daerah",
    kontak:"Hendra – 0815-1111-2222",buktiUndangan:"Memo No.5/2025",pakaian:"PDH",
    jenisKegiatan:"Menghadiri",catatan:"Halaman Kantor Walikota",untukPimpinan:["walikota"],alur:"menunggu_kabag"}),
];
const emptyForm={tanggal:"",jam:"",namaAcara:"",penyelenggara:"",kontak:"",buktiUndangan:"",
  pakaian:"PDH",jenisKegiatan:"Menghadiri",catatan:"",untukPimpinan:["walikota"]};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
const StatusPill=({alur,hapus})=>{
  if(hapus) return<span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,background:"#fff1f2",color:"#e11d48",whiteSpace:"nowrap"}}>🗑 {hapus==="menunggu_kasubbag"?"Minta Hapus":hapus==="menunggu_kabag"?"Hapus→Kabag":"Hapus Disetujui"}</span>;
  const c=WF[alur]||WF.draft;
  return<span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,background:c.bg,color:c.color,whiteSpace:"nowrap"}}>{c.label}</span>;
};
const JenisBadge=({j})=>{
  const m={Sambutan:{bg:"#fdf4ff",c:"#9333ea"},Pengarahan:{bg:"#eff6ff",c:"#2563eb"},Menghadiri:{bg:"#f0fdf4",c:"#16a34a"}};
  const x=m[j]||{bg:"#f1f5f9",c:"#64748b"};
  return<span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20,background:x.bg,color:x.c}}>{j}</span>;
};
function Toast({msg,type}){
  return<div style={{position:"fixed",top:56,left:"50%",transform:"translateX(-50%)",zIndex:9999,
    padding:"11px 18px",borderRadius:12,maxWidth:"88vw",textAlign:"center",
    background:type==="error"?"#fee2e2":type==="warn"?"#fef3c7":"#0B2545",
    color:type==="error"?"#991b1b":type==="warn"?"#92400e":"white",
    boxShadow:"0 6px 24px rgba(0,0,0,0.2)",fontSize:13,fontWeight:600}}>{msg}</div>;
}
function WorkflowBar({alur}){
  const steps=[{l:"Input",i:"✏️"},{l:"Kasubbag",i:"🔍"},{l:"Kabag",i:"✅"},{l:"Tayang",i:"🏛️"}];
  const order=["draft","menunggu_kasubbag","menunggu_kabag","disetujui"];
  const idx=alur==="ditolak"?0:order.indexOf(alur);
  return<div style={{display:"flex",alignItems:"center",marginBottom:12}}>
    {steps.map((s,i)=>{const done=idx>i,act=idx===i&&alur!=="ditolak";return(
      <div key={i} style={{display:"flex",alignItems:"center",flex:i<3?1:"auto"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:40}}>
          <div style={{width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,
            background:done?"#d1fae5":act?"#0B2545":"#f1f5f9",
            border:done?"2px solid #10b981":act?"2px solid #0B2545":"2px solid #e2e8f0",
            boxShadow:act?"0 0 0 3px rgba(11,37,69,0.12)":"none"}}>{done?"✓":s.i}</div>
          <span style={{fontSize:7,textAlign:"center",color:done?"#10b981":act?"#0B2545":"#94a3b8",fontWeight:done||act?700:400}}>{s.l}</span>
        </div>
        {i<3&&<div style={{flex:1,height:2,background:done?"#10b981":"#e2e8f0",margin:"0 2px",marginBottom:12}}/>}
      </div>);})}
  </div>;
}

// ─── PDF MODAL ────────────────────────────────────────────────────────────────
function PdfModal({file,nama,onClose}){
  return<div style={{position:"fixed",inset:0,zIndex:8500,background:"rgba(0,0,0,0.8)",display:"flex",flexDirection:"column"}} onClick={onClose}>
    <div style={{background:"#0B2545",padding:"11px 14px",display:"flex",alignItems:"center",gap:9}} onClick={e=>e.stopPropagation()}>
      <span style={{fontSize:17}}>📕</span>
      <span style={{color:"white",fontSize:13,fontWeight:700,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nama}</span>
      <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:7,color:"white",padding:"6px 11px",cursor:"pointer",fontSize:12,fontWeight:700}}>✕</button>
    </div>
    <div style={{flex:1}} onClick={e=>e.stopPropagation()}>
      <iframe src={file} title={nama} style={{width:"100%",height:"100%",border:"none"}}/>
    </div>
    <div style={{background:"#0B2545",padding:"9px 14px"}} onClick={e=>e.stopPropagation()}>
      <a href={file} download={nama} style={{display:"block",padding:"11px",borderRadius:9,background:"#C9A84C",color:"#0B2545",textAlign:"center",fontSize:13,fontWeight:700,textDecoration:"none"}}>⬇ Unduh PDF</a>
    </div>
  </div>;
}

// ─── SAMBUTAN BLOCK ───────────────────────────────────────────────────────────
function SambutanBlock({ev,canUpload,onUpload,onRemove}){
  const ref=useRef();const[load,setL]=useState(false);const[view,setV]=useState(false);
  const handleFile=f=>{
    if(!f)return;if(f.type!=="application/pdf"){alert("Hanya PDF.");return;}
    if(f.size>10*1024*1024){alert("Maks 10MB.");return;}
    setL(true);const r=new FileReader();
    r.onload=x=>{onUpload(x.target.result,f.name);setL(false);};r.readAsDataURL(f);
  };
  if(ev.sambutanFile)return<>
    {view&&<PdfModal file={ev.sambutanFile} nama={ev.sambutanNama} onClose={()=>setV(false)}/>}
    <div style={{background:"#f0fdf4",borderRadius:11,padding:11,border:"1.5px solid #bbf7d0"}}>
      <div style={{fontSize:11,color:"#065f46",fontWeight:700,marginBottom:7}}>📄 Naskah Sambutan</div>
      <div style={{display:"flex",alignItems:"center",gap:8,background:"white",borderRadius:8,padding:"8px 10px",border:"1px solid #d1fae5",marginBottom:7}}>
        <span style={{fontSize:17}}>📕</span>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.sambutanNama}</div></div>
      </div>
      <div style={{display:"flex",gap:7}}>
        <button onClick={()=>setV(true)} style={{flex:1,padding:"9px",borderRadius:8,border:"1.5px solid #0B2545",background:"white",color:"#0B2545",cursor:"pointer",fontSize:12,fontWeight:700}}>👁 Lihat</button>
        <a href={ev.sambutanFile} download={ev.sambutanNama} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:"#0B2545",color:"white",textDecoration:"none",textAlign:"center",fontSize:12,fontWeight:700,display:"block"}}>⬇ Unduh</a>
        {canUpload&&<button onClick={onRemove} style={{padding:"9px 10px",borderRadius:8,border:"1.5px solid #fca5a5",background:"white",color:"#ef4444",cursor:"pointer",fontSize:11,fontWeight:700}}>Ganti</button>}
      </div>
    </div>
  </>;
  if(canUpload)return<div style={{background:"#fafafa",borderRadius:11,padding:11,border:"1.5px dashed #c4b5fd"}}>
    <div style={{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:6}}>📄 Upload Naskah Sambutan</div>
    <input ref={ref} type="file" accept="application/pdf" onChange={e=>{handleFile(e.target.files[0]);e.target.value="";}} style={{display:"none"}}/>
    <button onClick={()=>ref.current.click()} disabled={load} style={{width:"100%",padding:"12px",borderRadius:8,border:"1.5px dashed #6366f1",background:load?"#f1f5f9":"white",color:"#6366f1",cursor:load?"default":"pointer",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
      {load?"⏳ Memproses...":<><span style={{fontSize:16}}>📎</span>Upload PDF Sambutan</>}
    </button>
    <div style={{fontSize:10,color:"#94a3b8",textAlign:"center",marginTop:4}}>Maks 10MB · PDF</div>
  </div>;
  return<div style={{padding:"8px 10px",background:"#fef9c3",borderRadius:8,fontSize:11,color:"#92400e",fontWeight:600}}>⏳ Naskah sambutan belum diupload Tim Komunikasi</div>;
}

// ─── DELEGATE MODAL ───────────────────────────────────────────────────────────
function DelegateModal({label,onConfirm,onCancel}){
  const[sel,setSel]=useState(""); const[cust,setCust]=useState(""); const fin=sel==="__c__"?cust:sel;
  return<div style={{position:"fixed",inset:0,zIndex:8200,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end"}}>
    <div style={{background:"white",borderRadius:"18px 18px 0 0",padding:18,width:"100%",maxWidth:430,margin:"0 auto",maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <div style={{width:32,height:4,borderRadius:4,background:"#e2e8f0",margin:"0 auto 12px"}}/>
      <div style={{fontSize:14,fontWeight:700,color:"#0B2545",marginBottom:3}}>⇄ Wakilkan Tugas</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:11}}>Pilih pejabat mewakili <strong>{label}</strong>:</div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:11}}>
        {PEJABAT.map(p=><button key={p} onClick={()=>setSel(p===sel?"":p)} style={{padding:"11px 13px",borderRadius:10,border:`1.5px solid ${sel===p?"#0B2545":"#e2e8f0"}`,background:sel===p?"#EBF0FA":"white",color:sel===p?"#0B2545":"#334155",cursor:"pointer",fontSize:12,fontWeight:sel===p?700:500,textAlign:"left",display:"flex",alignItems:"center",gap:9}}>
          <span style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${sel===p?"#0B2545":"#cbd5e1"}`,background:sel===p?"#0B2545":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {sel===p&&<span style={{width:6,height:6,borderRadius:"50%",background:"white",display:"block"}}/>}
          </span>{p}
        </button>)}
        <button onClick={()=>setSel("__c__")} style={{padding:"11px 13px",borderRadius:10,border:`1.5px solid ${sel==="__c__"?"#0B2545":"#e2e8f0"}`,background:sel==="__c__"?"#EBF0FA":"white",color:sel==="__c__"?"#0B2545":"#334155",cursor:"pointer",fontSize:12,textAlign:"left",display:"flex",alignItems:"center",gap:9}}>
          <span style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${sel==="__c__"?"#0B2545":"#cbd5e1"}`,background:sel==="__c__"?"#0B2545":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {sel==="__c__"&&<span style={{width:6,height:6,borderRadius:"50%",background:"white",display:"block"}}/>}
          </span>Pejabat lainnya...
        </button>
      </div>
      {sel==="__c__"&&<input placeholder="Nama pejabat..." value={cust} onChange={e=>setCust(e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",fontSize:14,marginBottom:11,background:"white",color:"#1e293b"}}/>}
      {fin&&<div style={{background:"#f0f9ff",borderRadius:9,padding:"8px 11px",marginBottom:11,border:"1px solid #bae6fd",fontSize:12,color:"#0284c7"}}>✅ <strong>{fin}</strong> akan mewakili. Konfirmasi?</div>}
      <div style={{display:"flex",gap:8}}>
        <button onClick={onCancel} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600}}>Batal</button>
        <button onClick={()=>fin.trim()&&onConfirm(fin)} disabled={!fin.trim()} style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:fin.trim()?"#0B2545":"#e2e8f0",color:fin.trim()?"white":"#94a3b8",cursor:fin.trim()?"pointer":"default",fontSize:13,fontWeight:700}}>✓ Konfirmasi Perwakilan</button>
      </div>
    </div>
  </div>;
}

// ─── AI MODAL ─────────────────────────────────────────────────────────────────
function AIModal({onFill,onClose}){
  const ref=useRef();
  const[drag,setDrag]=useState(false);
  const[loading,setLoading]=useState(false);
  const[result,setResult]=useState(null);
  const[edited,setEdited]=useState(null);
  const[err,setErr]=useState("");
  const[preview,setPreview]=useState(null);

  const analyze=async(file)=>{
    setLoading(true);setErr("");setResult(null);setEdited(null);
    const isPdf=file.type==="application/pdf";
    // Show preview for images
    if(!isPdf){const url=URL.createObjectURL(file);setPreview(url);}
    try{
      const base64=await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=e=>res(e.target.result.split(",")[1]);
        r.onerror=rej;r.readAsDataURL(file);
      });
      const bodyContent=isPdf
        ?[{type:"document",source:{type:"base64",media_type:"application/pdf",data:base64}},
          {type:"text",text:"Ini adalah surat undangan atau dokumen acara. Ekstrak informasi penting dan kembalikan HANYA JSON valid tanpa markdown fence:\n{\"namaAcara\":\"\",\"tanggal\":\"YYYY-MM-DD\",\"jam\":\"HH:MM\",\"penyelenggara\":\"\",\"kontak\":\"\",\"pakaian\":\"\",\"jenisKegiatan\":\"Sambutan|Pengarahan|Menghadiri\",\"catatan\":\"\",\"buktiUndangan\":\"\",\"untukPimpinan\":[\"walikota\"]}\nUntuk jenisKegiatan pilih hanya salah satu. Untuk pakaian pilih dari: PDH, Batik Korpri, Jas, PSL, PDU, Bebas Rapi. Untuk untukPimpinan bisa [\"walikota\"], [\"wakilwalikota\"], atau [\"walikota\",\"wakilwalikota\"]."}]
        :[{type:"image",source:{type:"base64",media_type:file.type,data:base64}},
          {type:"text",text:"Ini adalah foto/scan surat undangan atau dokumen acara. Baca teks yang ada dan ekstrak informasi penting. Kembalikan HANYA JSON valid tanpa markdown fence:\n{\"namaAcara\":\"\",\"tanggal\":\"YYYY-MM-DD\",\"jam\":\"HH:MM\",\"penyelenggara\":\"\",\"kontak\":\"\",\"pakaian\":\"\",\"jenisKegiatan\":\"Sambutan|Pengarahan|Menghadiri\",\"catatan\":\"\",\"buktiUndangan\":\"\",\"untukPimpinan\":[\"walikota\"]}\nUntuk jenisKegiatan pilih hanya salah satu. Untuk pakaian pilih dari: PDH, Batik Korpri, Jas, PSL, PDU, Bebas Rapi."}];
      const resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,messages:[{role:"user",content:bodyContent}]})
      });
      if(!resp.ok){const e=await resp.text();throw new Error("API error: "+e);}
      const data=await resp.json();
      const rawText=(data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
      // Extract JSON from response
      const jsonMatch=rawText.match(/\{[\s\S]*\}/);
      if(!jsonMatch)throw new Error("Tidak ada JSON ditemukan dalam respons");
      const parsed=JSON.parse(jsonMatch[0]);
      setResult(parsed);setEdited({...emptyForm,...parsed});
    }catch(e){
      console.error(e);
      setErr("Gagal menganalisa: "+e.message+". Silakan isi manual atau coba lagi.");
    }
    setLoading(false);
  };

  const handleFile=f=>{
    if(!f)return;
    const ok=f.type==="application/pdf"||f.type.startsWith("image/");
    if(!ok){setErr("Format tidak didukung. Gunakan PDF atau gambar (JPG, PNG).");return;}
    if(f.size>20*1024*1024){setErr("File terlalu besar (maks 20MB).");return;}
    analyze(f);
  };

  return<div style={{position:"fixed",inset:0,zIndex:8100,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"flex-end"}}>
    <div style={{background:"white",borderRadius:"18px 18px 0 0",width:"100%",maxWidth:430,margin:"0 auto",maxHeight:"92vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"14px 17px 11px",borderBottom:"1px solid #f1f5f9",flexShrink:0}}>
        <div style={{width:32,height:4,borderRadius:4,background:"#e2e8f0",margin:"0 auto 11px"}}/>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:20}}>🤖</span>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:"#0B2545"}}>Analisa Undangan — AI</div>
            <div style={{fontSize:11,color:"#64748b"}}>Upload PDF atau foto undangan, form terisi otomatis</div>
          </div>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:7,padding:"5px 9px",cursor:"pointer",fontSize:12,fontWeight:700,color:"#64748b"}}>✕</button>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"13px 17px 18px"}}>
        {!result&&!loading&&<>
          <input ref={ref} type="file" accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp" onChange={e=>{handleFile(e.target.files[0]);e.target.value="";}} style={{display:"none"}}/>
          <div
            onClick={()=>ref.current.click()}
            onDragOver={e=>{e.preventDefault();setDrag(true);}}
            onDragLeave={()=>setDrag(false)}
            onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
            style={{border:`2px dashed ${drag?"#6366f1":"#c7d2fe"}`,borderRadius:13,padding:"32px 18px",textAlign:"center",cursor:"pointer",background:drag?"#eef2ff":"#f8fafc",transition:"all 0.2s"}}>
            <div style={{fontSize:38,marginBottom:9}}>{drag?"📂":"📎"}</div>
            <div style={{fontSize:14,fontWeight:700,color:"#0B2545",marginBottom:3}}>Seret & lepas file di sini</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:11}}>atau klik untuk pilih file</div>
            <div style={{display:"inline-flex",gap:5,flexWrap:"wrap",justifyContent:"center"}}>
              {["PDF","JPG","PNG"].map(t=><span key={t} style={{fontSize:10,padding:"2px 8px",borderRadius:5,background:"#e0e7ff",color:"#4338ca",fontWeight:700}}>{t}</span>)}
            </div>
          </div>
          {err&&<div style={{marginTop:11,padding:"9px 11px",background:"#fee2e2",borderRadius:8,fontSize:12,color:"#991b1b",fontWeight:600}}>{err}</div>}
          <div style={{marginTop:13,padding:"9px 11px",background:"#f0f9ff",borderRadius:9,border:"1px solid #bae6fd",fontSize:11,color:"#0369a1"}}>
            💡 Tips: Upload foto atau scan undangan resmi untuk hasil terbaik. AI akan membaca teks dan mengisi form secara otomatis.
          </div>
        </>}

        {loading&&<div style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{fontSize:36,marginBottom:11}}>⚙️</div>
          <div style={{fontSize:14,fontWeight:700,color:"#0B2545",marginBottom:3}}>AI sedang membaca dokumen...</div>
          <div style={{fontSize:11,color:"#64748b"}}>Mengekstrak informasi dari undangan</div>
          <div style={{marginTop:14,height:4,background:"#e2e8f0",borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",background:"linear-gradient(90deg,#6366f1,#8b5cf6)",borderRadius:4,animation:"shimmer 1.5s infinite",width:"60%"}}/>
          </div>
        </div>}

        {edited&&result&&<>
          <div style={{background:"#d1fae5",borderRadius:9,padding:"8px 11px",marginBottom:12,fontSize:12,color:"#065f46",fontWeight:700}}>
            ✅ Analisa selesai! Periksa & koreksi sebelum digunakan.
          </div>
          {preview&&<img src={preview} alt="preview" style={{width:"100%",borderRadius:9,marginBottom:11,maxHeight:160,objectFit:"cover"}}/>}
          {[{k:"namaAcara",l:"Nama Acara",t:"text"},{k:"tanggal",l:"Tanggal",t:"date"},{k:"jam",l:"Jam",t:"time"},
            {k:"penyelenggara",l:"Penyelenggara",t:"text"},{k:"kontak",l:"Kontak",t:"text"},
            {k:"buktiUndangan",l:"No. Surat",t:"text"},{k:"catatan",l:"Catatan",t:"text"}].map(f=>(
            <div key={f.k} style={{marginBottom:9}}>
              <label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:2}}>{f.l}</label>
              <input type={f.t} value={edited[f.k]||""} onChange={e=>setEdited(p=>({...p,[f.k]:e.target.value}))}
                style={{width:"100%",padding:"9px 11px",borderRadius:8,border:`1.5px solid ${edited[f.k]&&edited[f.k]!==result[f.k]?"#f59e0b":"#e2e8f0"}`,fontSize:14,background:"white",color:"#1e293b"}}/>
              {edited[f.k]&&edited[f.k]!==result[f.k]&&<div style={{fontSize:9,color:"#d97706",marginTop:2,fontWeight:700}}>⚠ DIUBAH dari: "{result[f.k]||"kosong"}"</div>}
              {!edited[f.k]&&<div style={{fontSize:9,color:"#ef4444",marginTop:2,fontWeight:600}}>⚠ Belum terisi — harap isi manual</div>}
            </div>
          ))}
          <div style={{marginBottom:9}}>
            <label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:3}}>Pakaian</label>
            <select value={edited.pakaian||"PDH"} onChange={e=>setEdited(p=>({...p,pakaian:e.target.value}))} style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14,background:"white",color:"#1e293b"}}>
              {PAKAIAN.map(x=><option key={x}>{x}</option>)}
            </select>
          </div>
          <div style={{marginBottom:9}}>
            <label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:3}}>Jenis Kegiatan</label>
            <select value={edited.jenisKegiatan||"Menghadiri"} onChange={e=>setEdited(p=>({...p,jenisKegiatan:e.target.value}))} style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14,background:"white",color:"#1e293b"}}>
              {JENIS.map(x=><option key={x}>{x}</option>)}
            </select>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:5}}>Untuk Pimpinan</label>
            <div style={{display:"flex",gap:8}}>
              {[{key:"walikota",label:"Wali Kota"},{key:"wakilwalikota",label:"Wakil"}].map(p=>(
                <label key={p.key} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"9px",borderRadius:8,cursor:"pointer",border:(edited.untukPimpinan||[]).includes(p.key)?"2px solid #0B2545":"2px solid #e2e8f0",background:(edited.untukPimpinan||[]).includes(p.key)?"#EBF0FA":"white",fontSize:11,fontWeight:700,color:(edited.untukPimpinan||[]).includes(p.key)?"#0B2545":"#94a3b8"}}>
                  <input type="checkbox" checked={(edited.untukPimpinan||[]).includes(p.key)} style={{display:"none"}} onChange={e=>{const v=e.target.checked?[...(edited.untukPimpinan||[]),p.key]:(edited.untukPimpinan||[]).filter(x=>x!==p.key);setEdited(prev=>({...prev,untukPimpinan:v}));}}/>
                  {(edited.untukPimpinan||[]).includes(p.key)?"☑":"☐"} {p.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setResult(null);setEdited(null);setErr("");setPreview(null);}} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",cursor:"pointer",fontSize:12,fontWeight:600,color:"#64748b"}}>↩ Upload Ulang</button>
            <button onClick={()=>onFill(edited)} style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:"#0B2545",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>✓ Gunakan Data Ini</button>
          </div>
        </>}
      </div>
    </div>
  </div>;
}

// ─── SUMMARY MODAL (Share Publik) ─────────────────────────────────────────────
function SummaryModal({events,onToggleHide,onClose}){
  const today=todayStr();
  const todayEvents=events.filter(e=>e.tanggal===today&&e.alur==="disetujui").sort((a,b)=>a.jam.localeCompare(b.jam));
  const publicEvents=todayEvents.filter(e=>!e.tersembunyi);

  const buildShareText=()=>{
    const lines=["📅 *AGENDA KEGIATAN PIMPINAN*",`*${getHari(today)}, ${fmt(today)}*`,""];
    publicEvents.forEach((ev,i)=>{
      lines.push(`*${i+1}. ${ev.namaAcara}*`);
      lines.push(`🕐 ${ev.jam} WIB`);
      lines.push(`🏢 ${ev.penyelenggara}`);
      lines.push(`👔 Pakaian: ${ev.pakaian}`);
      if(ev.catatan)lines.push(`📌 ${ev.catatan}`);
      lines.push("");
    });
    lines.push("_Bagian Protokol & Komunikasi Pimpinan_");
    return lines.join("\n");
  };

  const shareText=buildShareText();

  const copyToClipboard=()=>{
    navigator.clipboard.writeText(shareText).catch(()=>{
      const ta=document.createElement("textarea");ta.value=shareText;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);
    });
  };

  const printSummary=()=>{
    const w=window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Agenda Pimpinan</title>
<style>
  @page{size:A4;margin:2cm}
  body{font-family:'Georgia',serif;font-size:12pt;color:#1a1a1a;line-height:1.6}
  .header{text-align:center;border-bottom:2px solid #0B2545;padding-bottom:12px;margin-bottom:20px}
  .header h1{font-size:16pt;color:#0B2545;margin:0 0 4px}
  .header p{font-size:11pt;color:#64748b;margin:0}
  .event{margin-bottom:16px;padding:12px 14px;border-left:4px solid #0B2545;background:#f8fafc;page-break-inside:avoid}
  .event-title{font-size:13pt;font-weight:bold;color:#0B2545;margin-bottom:4px}
  .event-row{font-size:11pt;color:#334155;margin:2px 0}
  .footer{margin-top:24px;text-align:center;font-size:10pt;color:#64748b;border-top:1px solid #e2e8f0;padding-top:10px}
</style></head><body>
<div class="header"><h1>AGENDA KEGIATAN PIMPINAN</h1><p>${getHari(today)}, ${fmt(today)}</p></div>
${publicEvents.map((ev,i)=>`<div class="event">
  <div class="event-title">${i+1}. ${ev.namaAcara}</div>
  <div class="event-row">⏰ Pukul ${ev.jam} WIB</div>
  <div class="event-row">🏢 Penyelenggara: ${ev.penyelenggara}</div>
  <div class="event-row">👔 Pakaian: ${ev.pakaian}</div>
  ${ev.catatan?`<div class="event-row">📌 Catatan: ${ev.catatan}</div>`:""}
</div>`).join("")}
<div class="footer">Bagian Protokol &amp; Komunikasi Pimpinan</div>
</body></html>`);
    w.document.close();w.focus();setTimeout(()=>w.print(),400);
  };

  return<div style={{position:"fixed",inset:0,zIndex:8100,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end"}}>
    <div style={{background:"white",borderRadius:"18px 18px 0 0",width:"100%",maxWidth:430,margin:"0 auto",maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"14px 17px 11px",borderBottom:"1px solid #f1f5f9",flexShrink:0}}>
        <div style={{width:32,height:4,borderRadius:4,background:"#e2e8f0",margin:"0 auto 11px"}}/>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:20}}>📢</span>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:"#0B2545"}}>Rangkuman Agenda Hari Ini</div>
          <div style={{fontSize:11,color:"#64748b"}}>{fmt(today)} · {publicEvents.length}/{todayEvents.length} ditampilkan</div></div>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:7,padding:"5px 9px",cursor:"pointer",fontSize:12,fontWeight:700,color:"#64748b"}}>✕</button>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"13px 17px 18px"}}>
        {todayEvents.length===0?<div style={{textAlign:"center",padding:"30px",color:"#94a3b8",fontSize:13}}>Tidak ada agenda hari ini</div>:(
          <>
            <div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:9}}>Ketuk 👁 untuk sembunyikan dari publik:</div>
            {todayEvents.map(ev=><div key={ev.id} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 12px",borderRadius:10,marginBottom:7,background:ev.tersembunyi?"#f8fafc":"white",border:`1.5px solid ${ev.tersembunyi?"#e2e8f0":"#0B2545"}`,opacity:ev.tersembunyi?0.55:1}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:"#0F2040",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.namaAcara}</div>
                <div style={{fontSize:10,color:"#64748b"}}>🕐 {ev.jam} · {ev.penyelenggara}</div>
              </div>
              <button onClick={()=>onToggleHide(ev.id)} style={{flexShrink:0,padding:"6px 9px",borderRadius:8,border:`1.5px solid ${ev.tersembunyi?"#e2e8f0":"#0B2545"}`,background:ev.tersembunyi?"#f1f5f9":"#EBF0FA",color:ev.tersembunyi?"#94a3b8":"#0B2545",cursor:"pointer",fontSize:11,fontWeight:700}}>
                {ev.tersembunyi?"🙈 Tersembunyi":"👁 Tampilkan"}
              </button>
            </div>)}

            {publicEvents.length>0&&<>
              <div style={{background:"#f8fafc",borderRadius:10,padding:11,border:"1px solid #e2e8f0",marginTop:4,marginBottom:11}}>
                <div style={{fontSize:11,fontWeight:700,color:"#0B2545",marginBottom:7}}>📋 Preview Teks Publik</div>
                <pre style={{fontSize:11,color:"#334155",whiteSpace:"pre-wrap",fontFamily:"sans-serif",margin:0,lineHeight:1.6}}>{shareText}</pre>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <button onClick={copyToClipboard} style={{padding:"12px",borderRadius:10,border:"none",background:"#0B2545",color:"white",cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
                  📋 Salin Teks (WhatsApp/Medsos)
                </button>
                <button onClick={printSummary} style={{padding:"12px",borderRadius:10,border:"1.5px solid #0B2545",background:"white",color:"#0B2545",cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
                  🖨 Cetak / Simpan PDF A4
                </button>
              </div>
            </>}
          </>
        )}
      </div>
    </div>
  </div>;
}

// ─── REPORTING MODAL (PDF A4) ─────────────────────────────────────────────────
function ReportingModal({events,onClose}){
  const[mode,setMode]=useState("today");
  const[from,setFrom]=useState(todayStr());
  const[to,setTo]=useState(todayStr());
  const modeLabel={today:"Hari Ini",tomorrow:"Besok",week:"Minggu Ini",month:"Bulan Ini",range:"Rentang Tanggal"};
  const filtered=events.filter(e=>{
    if(mode==="today")   return e.tanggal===todayStr();
    if(mode==="tomorrow")return e.tanggal===tomorrowStr();
    if(mode==="week")    return e.tanggal>=weekStart()&&e.tanggal<=weekEnd();
    if(mode==="month")   return e.tanggal>=monthStart()&&e.tanggal<=monthEnd();
    if(mode==="range")   return e.tanggal>=from&&e.tanggal<=to;
    return true;
  }).filter(e=>e.alur==="disetujui").sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));

  const printPDF=()=>{
    const w=window.open("","_blank");
    const rows=filtered.map((ev,i)=>`<tr>
      <td style="text-align:center">${i+1}</td>
      <td style="white-space:nowrap">${getHari(ev.tanggal)}<br><small>${fmtShort(ev.tanggal)}</small></td>
      <td style="text-align:center">${ev.jam}</td>
      <td><strong>${ev.namaAcara}</strong></td>
      <td>${ev.jenisKegiatan||"-"}</td>
      <td>${ev.penyelenggara}</td>
      <td>${ev.pakaian}</td>
      <td style="text-align:center">${ev.untukPimpinan.includes("walikota")?(ev.delegasiKeWWK?"→WWK":ev.statusWK||"—"):"—"}</td>
      <td style="text-align:center">${ev.untukPimpinan.includes("wakilwalikota")?(ev.statusWWK||"—"):"—"}</td>
    </tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rekap Kegiatan</title>
<style>
  @page{size:A4 landscape;margin:1.5cm}
  body{font-family:Arial,sans-serif;font-size:9pt;color:#1a1a1a}
  h2{text-align:center;font-size:13pt;color:#0B2545;margin:0 0 3px}
  .sub{text-align:center;font-size:9pt;color:#64748b;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;font-size:8.5pt}
  th{background:#0B2545;color:white;padding:7px 6px;text-align:left;font-size:8pt}
  td{padding:6px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  .footer{margin-top:10px;text-align:right;font-size:8pt;color:#94a3b8}
</style></head><body>
<h2>REKAP KEGIATAN PIMPINAN</h2>
<p class="sub">${modeLabel[mode]} — Dicetak: ${fmt(todayStr())} | Total: ${filtered.length} kegiatan</p>
<table>
  <thead><tr>
    <th style="width:24px">No</th><th>Hari/Tgl</th><th>Jam</th><th>Nama Acara</th>
    <th>Jenis</th><th>Penyelenggara</th><th>Pakaian</th><th>Status WK</th><th>Status WWK</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">Bagian Protokol &amp; Komunikasi Pimpinan</div>
</body></html>`);
    w.document.close();w.focus();setTimeout(()=>w.print(),400);
  };

  return<div style={{position:"fixed",inset:0,zIndex:8100,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end"}}>
    <div style={{background:"white",borderRadius:"18px 18px 0 0",width:"100%",maxWidth:430,margin:"0 auto",maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"14px 17px 11px",borderBottom:"1px solid #f1f5f9",flexShrink:0}}>
        <div style={{width:32,height:4,borderRadius:4,background:"#e2e8f0",margin:"0 auto 11px"}}/>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:20}}>📊</span>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:"#0B2545"}}>Rekap Kegiatan</div>
          <div style={{fontSize:11,color:"#64748b"}}>Export & cetak PDF A4 Landscape</div></div>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:7,padding:"5px 9px",cursor:"pointer",fontSize:12,fontWeight:700,color:"#64748b"}}>✕</button>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"13px 17px 18px"}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
          {["today","tomorrow","week","month","range"].map(m=><button key={m} onClick={()=>setMode(m)} style={{padding:"6px 12px",borderRadius:20,border:`1.5px solid ${mode===m?"#0B2545":"#e2e8f0"}`,background:mode===m?"#0B2545":"white",color:mode===m?"white":"#475569",cursor:"pointer",fontSize:11,fontWeight:700}}>{modeLabel[m]}</button>)}
        </div>
        {mode==="range"&&<div style={{display:"flex",gap:7,marginBottom:12,alignItems:"center"}}>
          <div style={{flex:1}}><label style={{fontSize:10,color:"#64748b",fontWeight:600,display:"block",marginBottom:2}}>Dari</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14}}/></div>
          <span style={{color:"#94a3b8",marginTop:14}}>—</span>
          <div style={{flex:1}}><label style={{fontSize:10,color:"#64748b",fontWeight:600,display:"block",marginBottom:2}}>Sampai</label>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:14}}/></div>
        </div>}
        <div style={{background:"#f8fafc",borderRadius:10,padding:"9px 11px",marginBottom:12,display:"flex",alignItems:"center",gap:9}}>
          <span style={{fontSize:20}}>📋</span>
          <div><div style={{fontSize:12,fontWeight:700,color:"#0B2545"}}>{filtered.length} kegiatan ditemukan</div>
          <div style={{fontSize:10,color:"#64748b"}}>{modeLabel[mode]} · Hanya jadwal disetujui</div></div>
        </div>
        {filtered.length>0&&<div style={{overflowX:"auto",marginBottom:14}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr style={{background:"#0B2545",color:"white"}}>
              {["Tgl","Jam","Acara","Jenis","Pakaian"].map(h=><th key={h} style={{padding:"6px 7px",textAlign:"left",whiteSpace:"nowrap",fontWeight:700}}>{h}</th>)}
            </tr></thead>
            <tbody>{filtered.map((ev,i)=><tr key={ev.id} style={{background:i%2===0?"white":"#f8fafc"}}>
              <td style={{padding:"5px 7px",fontSize:10,color:"#64748b",whiteSpace:"nowrap"}}>{getHari(ev.tanggal).slice(0,3)}, {new Date(ev.tanggal+"T00:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"short"})}</td>
              <td style={{padding:"5px 7px",whiteSpace:"nowrap"}}>{ev.jam}</td>
              <td style={{padding:"5px 7px",fontWeight:600,color:"#0B2545",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.namaAcara}</td>
              <td style={{padding:"5px 7px"}}><JenisBadge j={ev.jenisKegiatan}/></td>
              <td style={{padding:"5px 7px",fontSize:10}}>{ev.pakaian}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <button onClick={printPDF} disabled={filtered.length===0} style={{width:"100%",padding:"13px",borderRadius:11,border:"none",background:filtered.length?"#0B2545":"#e2e8f0",color:filtered.length?"white":"#94a3b8",cursor:filtered.length?"pointer":"default",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
          🖨 Cetak / Simpan PDF A4
        </button>
      </div>
    </div>
  </div>;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY;

async function loadFromSupabase() {
  const res = await fetch(`${SUPA_URL}/rest/v1/jadwal?select=data`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
  });
  const rows = await res.json();
  return rows.map(r => r.data);
}

async function saveToSupabase(events) {
  await fetch(`${SUPA_URL}/rest/v1/jadwal`, {
    method: "DELETE",
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json" }
  });
  if (events.length === 0) return;
  await fetch(`${SUPA_URL}/rest/v1/jadwal`, {
    method: "POST",
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
      "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(events.map(e => ({ id: e.id, data: e })))
  });
}
export default function App(){
  const[user,setUser]=useState(null); // full user object from USERS
  const role=user?.role||null;
  const[loginForm,setLF]=useState({username:"",password:""});
  const[loginErr,setLE]=useState("");
  const[showPass,setShowPass]=useState(false);
  const[events,setEvents]=useState(seed);
  const[tab,setTab]=useState("jadwal");
  const[form,setForm]=useState(emptyForm);
  const[editId,setEditId]=useState(null);
  const[toast,setToast]=useState(null);
  const[filterDate,setFDate]=useState("");
  const[showAI,setShowAI]=useState(false);
  const[showReport,setShowReport]=useState(false);
  const[showSummary,setShowSummary]=useState(false);
  const[delegTarget,setDelegTarget]=useState(null);
  const[expandedId,setExp]=useState(null);
  const[rejectTexts,setRT]=useState({});
  const[catatanInput,setCatatanInput]=useState({});

  const doLogin=()=>{
    const u=USERS.find(u=>u.username===loginForm.username.toLowerCase().trim()&&u.password===loginForm.password);
    if(!u){setLE("Username atau password salah. Coba lagi.");return;}
    setUser(u);setTab("jadwal");setLE("");
  };

  const showT=(msg,type="ok")=>{setToast({msg,type});setTimeout(()=>setToast(null),2800);};
  const upd=(id,patch)=>setEvents(p=>p.map(e=>e.id===id?{...e,...patch}:e));
  const hariForm=form.tanggal?getHari(form.tanggal):"";

  // Visibility
  const getVisible=()=>{
    let base=events;
    if(role==="walikota")      base=events.filter(e=>e.untukPimpinan.includes("walikota")&&e.alur==="disetujui");
    else if(role==="wakilwalikota") base=events.filter(e=>e.alur==="disetujui"&&(e.untukPimpinan.includes("wakilwalikota")||e.delegasiKeWWK));
    else if(role==="ajudan")   base=events.filter(e=>e.alur==="disetujui");
    else if(role==="timkom")   base=events.filter(e=>e.alur!=="ditolak");
    else if(role==="kasubbag") base=tab==="semua"?events:events.filter(e=>e.alur==="menunggu_kasubbag"||(e.alurHapus&&e.alur==="disetujui"));
    else if(role==="kabag")    base=tab==="semua"?events:events.filter(e=>e.alur==="menunggu_kabag"||(e.alurHapus==="menunggu_kabag"));
    if(filterDate) base=base.filter(e=>e.tanggal===filterDate);
    return base.sort((a,b)=>(a.tanggal+a.jam).localeCompare(b.tanggal+b.jam));
  };

  const pendingList=events.filter(e=>{
    if(role==="kasubbag") return e.alur==="menunggu_kasubbag"||(e.alurHapus==="menunggu_kasubbag");
    if(role==="kabag")    return e.alur==="menunggu_kabag"||(e.alurHapus==="menunggu_kabag");
    if(role==="timkom")   return e.alur==="disetujui"&&!e.sambutanFile&&e.jenisKegiatan==="Sambutan";
    if(role==="walikota") return e.untukPimpinan.includes("walikota")&&e.alur==="disetujui"&&!e.statusWK;
    if(role==="wakilwalikota") return e.alur==="disetujui"&&(e.untukPimpinan.includes("wakilwalikota")||e.delegasiKeWWK)&&!e.statusWWK;
    return false;
  });

  const goToPending=()=>{
    if(!pendingList.length)return;
    setFDate(""); setExp(pendingList[0].id);
    setTimeout(()=>document.getElementById("ev-"+pendingList[0].id)?.scrollIntoView({behavior:"smooth",block:"center"}),200);
  };

  const submit=()=>{
    if(!form.namaAcara||!form.tanggal||!form.jam){showT("Nama acara, tanggal & jam wajib diisi.","error");return;}
    const conflict=hasConflict(events,{...form,id:editId||0,alur:"disetujui"});
    if(editId!==null){
      setEvents(p=>p.map(e=>e.id===editId?{...e,...form}:e));
      showT("Jadwal diperbarui ✓");setEditId(null);
    }else{
      const n={...form,id:Date.now(),alur:"draft",catatanTolak:"",statusWK:null,statusWWK:null,
        perwakilanWK:"",perwakilanWWK:"",delegasiKeWWK:false,sambutanFile:null,sambutanNama:"",
        catatanPimpinan:"",tersembunyi:false,alurHapus:null};
      setEvents(p=>[...p,n]);
      if(conflict)showT("⚠️ Potensi tabrakan jadwal di tanggal ini!","warn");
      else showT("Draft disimpan. Kirim ke Kasubbag Protokol.");
    }
    setForm(emptyForm);setTab("jadwal");
  };

  const roleInfo=ALL_ROLES.find(r=>r.key===role)||{icon:"👤",label:""};
  const TH={
    walikota:{g:"linear-gradient(135deg,#0B2545,#1B4080)",a:"#C9A84C"},
    wakilwalikota:{g:"linear-gradient(135deg,#053f2a,#065f46)",a:"#6ee7b7"},
    ajudan:{g:"linear-gradient(135deg,#1e293b,#334155)",a:"#94a3b8"},
    timkom:{g:"linear-gradient(135deg,#3730a3,#4f46e5)",a:"#a5b4fc"},
    staf:{g:"linear-gradient(135deg,#0B2545,#1B4080)",a:"#C9A84C"},
    kasubbag:{g:"linear-gradient(135deg,#78350f,#d97706)",a:"#fde68a"},
    kabag:{g:"linear-gradient(135deg,#064e3b,#10b981)",a:"#6ee7b7"},
  };
  const th=TH[role]||TH.staf;

  // ── LOGIN SCREEN ──
  if(!user)return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0B2545 0%,#1B4080 60%,#0d3d2e 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{`*{box-sizing:border-box;-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Arial,sans-serif}@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}input,select,textarea{font-size:16px!important;-webkit-appearance:none;font-family:inherit}a{-webkit-tap-highlight-color:transparent}`}</style>
      {/* Letterhead */}
      <div style={{textAlign:"center",marginBottom:24,animation:"up 0.4s ease"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14,marginBottom:12}}>
          <div style={{width:60,height:60,borderRadius:"50%",background:"rgba(201,168,76,0.15)",border:"2px solid #C9A84C",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,flexShrink:0}}>🏛️</div>
          <div style={{textAlign:"left"}}>
            <div style={{color:"#C9A84C",fontSize:9,letterSpacing:2,textTransform:"uppercase",fontWeight:700}}>Pemerintah Kota Tarakan</div>
            <div style={{color:"white",fontSize:15,fontWeight:700,lineHeight:1.3,letterSpacing:0.3}}>Bagian Protokol &</div>
            <div style={{color:"white",fontSize:15,fontWeight:700,letterSpacing:0.3}}>Komunikasi Pimpinan</div>
          </div>
        </div>
        <div style={{width:"100%",maxWidth:340,height:1,background:"linear-gradient(90deg,transparent,#C9A84C,transparent)",margin:"0 auto 12px"}}/>
        <div style={{color:"rgba(255,255,255,0.6)",fontSize:11}}>Sistem Informasi Jadwal Kegiatan Pimpinan</div>
      </div>

      {/* Login Card */}
      <div style={{width:"100%",maxWidth:360,background:"rgba(255,255,255,0.07)",backdropFilter:"blur(16px)",borderRadius:18,padding:24,border:"1px solid rgba(255,255,255,0.13)",animation:"up 0.5s ease"}}>
        <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.7)",marginBottom:16,textAlign:"center",letterSpacing:1}}>MASUK KE SISTEM</div>

        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:11,color:"rgba(255,255,255,0.55)",fontWeight:600,marginBottom:5,letterSpacing:0.5}}>USERNAME</label>
          <input
            type="text" value={loginForm.username}
            onChange={e=>setLF(p=>({...p,username:e.target.value}))}
            onKeyDown={e=>e.key==="Enter"&&doLogin()}
            placeholder="Masukkan username"
            autoCapitalize="none" autoCorrect="off"
            style={{width:"100%",padding:"13px 14px",borderRadius:11,border:"1.5px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.1)",color:"white",fontSize:15,outline:"none"}}/>
        </div>

        <div style={{marginBottom:6}}>
          <label style={{display:"block",fontSize:11,color:"rgba(255,255,255,0.55)",fontWeight:600,marginBottom:5,letterSpacing:0.5}}>PASSWORD</label>
          <div style={{position:"relative"}}>
            <input
              type={showPass?"text":"password"} value={loginForm.password}
              onChange={e=>setLF(p=>({...p,password:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&doLogin()}
              placeholder="Masukkan password"
              style={{width:"100%",padding:"13px 44px 13px 14px",borderRadius:11,border:"1.5px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.1)",color:"white",fontSize:15,outline:"none"}}/>
            <button onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.5)",fontSize:16,padding:4}}>
              {showPass?"🙈":"👁"}
            </button>
          </div>
        </div>

        {loginErr&&<div style={{background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:9,padding:"9px 12px",marginBottom:12,fontSize:12,color:"#fca5a5",fontWeight:600,animation:"up 0.2s ease"}}>
          ⚠️ {loginErr}
        </div>}

        <button onClick={doLogin} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#C9A84C,#b8952e)",color:"#0B2545",cursor:"pointer",fontSize:14,fontWeight:700,marginTop:8,letterSpacing:0.5,boxShadow:"0 4px 16px rgba(201,168,76,0.35)",WebkitTapHighlightColor:"transparent"}}>
          MASUK →
        </button>

        <div style={{marginTop:18,padding:"10px 12px",background:"rgba(255,255,255,0.05)",borderRadius:9,border:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginBottom:5,fontWeight:600,letterSpacing:1}}>AKUN DEMO</div>
          {USERS.map(u=><div key={u.username} style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"rgba(255,255,255,0.45)",padding:"2px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <span>{u.jabatan}</span>
            <span style={{color:"rgba(201,168,76,0.7)",fontFamily:"monospace"}}>{u.username} / {u.password}</span>
          </div>)}
        </div>
      </div>

      <div style={{color:"rgba(255,255,255,0.2)",fontSize:9,marginTop:18,letterSpacing:1,textAlign:"center"}}>
        PROTOTYPE v1.0 · Bagian Protokol & Komunikasi Pimpinan<br/>Pemerintah Kota Tarakan
      </div>
    </div>
  );

  const listEvents=getVisible();
  const showForm=tab==="form"&&role==="staf";
  const tabItems=role==="staf"?[{key:"jadwal",icon:"📅",label:"Jadwal"},{key:"form",icon:"✏️",label:"Input"}]:
    (role==="kasubbag"||role==="kabag")?[{key:"jadwal",icon:"📋",label:"Antrian"},{key:"semua",icon:"📅",label:"Semua"}]:[];

  const isLeader=role==="walikota"||role==="wakilwalikota";

  return(
    <div style={{minHeight:"100vh",background:"#F0F2F5",maxWidth:430,margin:"0 auto"}}>
      <style>{`*{box-sizing:border-box;-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Arial,sans-serif}@keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}input,select,textarea{font-size:16px!important;-webkit-appearance:none;font-family:inherit}a{-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{display:none}`}</style>
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
      {showAI&&<AIModal onFill={d=>{setForm(p=>({...p,...d}));setShowAI(false);setTab("form");showT("✅ Form terisi dari AI. Periksa sebelum menyimpan.","warn");}} onClose={()=>setShowAI(false)}/>}
      {showReport&&<ReportingModal events={events} onClose={()=>setShowReport(false)}/>}
      {showSummary&&<SummaryModal events={events} onToggleHide={id=>upd(id,{tersembunyi:!events.find(e=>e.id===id)?.tersembunyi})} onClose={()=>setShowSummary(false)}/>}
      {delegTarget&&<DelegateModal
        label={delegTarget.side==="wk"?"Wali Kota":"Wakil Wali Kota"}
        onConfirm={name=>{
          if(delegTarget.side==="wk") upd(delegTarget.id,{statusWK:"diwakilkan",perwakilanWK:name,delegasiKeWWK:false});
          else upd(delegTarget.id,{statusWWK:"diwakilkan",perwakilanWWK:name});
          setDelegTarget(null);showT(`Diwakilkan ke ${name}`);
        }}
        onCancel={()=>setDelegTarget(null)}/>}

      {/* TOP BAR */}
      <div style={{background:th.g,position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 14px rgba(0,0,0,0.25)"}}>
        <div style={{padding:"11px 13px 9px",display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:33,height:33,borderRadius:9,background:"rgba(255,255,255,0.1)",border:`1.5px solid ${th.a}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{roleInfo.icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:"white",fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.nama||roleInfo.label}</div>
            <div style={{color:"rgba(255,255,255,0.5)",fontSize:9,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.jabatan||""}</div>
          </div>
          {pendingList.length>0&&<button onClick={goToPending} style={{background:"#ef4444",color:"white",borderRadius:20,padding:"4px 9px",fontSize:10,fontWeight:700,border:"none",cursor:"pointer",flexShrink:0}}>{pendingList.length} pending ›</button>}
          <button onClick={()=>setShowSummary(true)} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:8,color:"white",padding:"5px 8px",cursor:"pointer",fontSize:11,fontWeight:700,flexShrink:0}}>📢</button>
          <button onClick={()=>setShowReport(true)} style={{background:"rgba(255,255,255,0.12)",border:"none",borderRadius:8,color:"white",padding:"5px 8px",cursor:"pointer",fontSize:12,fontWeight:700,flexShrink:0}}>📊</button>
          <button onClick={()=>setUser(null)} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,color:"white",padding:"5px 9px",cursor:"pointer",fontSize:11,fontWeight:600,flexShrink:0}}>Keluar</button>
        </div>
        {tabItems.length>1&&<div style={{display:"flex",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          {tabItems.map(t2=><button key={t2.key} onClick={()=>{setTab(t2.key);if(t2.key==="form"){setForm(emptyForm);setEditId(null);}}} style={{flex:1,padding:"9px 0",border:"none",cursor:"pointer",background:"transparent",color:"white",fontSize:12,fontWeight:700,borderBottom:tab===t2.key?`2.5px solid ${th.a}`:"2.5px solid transparent",opacity:tab===t2.key?1:0.5,WebkitTapHighlightColor:"transparent"}}>{t2.icon} {t2.label}</button>)}
        </div>}
      </div>

      {/* QUICK FILTERS */}
      {!showForm&&<div style={{padding:"8px 13px 1px",display:"flex",gap:5,overflowX:"auto",scrollbarWidth:"none"}}>
        {[{l:"Hari Ini",v:todayStr()},{l:"Besok",v:tomorrowStr()},{l:"Semua",v:""}].map(q=>{
          const active=filterDate===q.v&&(q.v!==""||filterDate==="");
          return<button key={q.l} onClick={()=>setFDate(q.v)} style={{padding:"5px 11px",borderRadius:20,border:`1.5px solid ${active?"#0B2545":"#e2e8f0"}`,background:active?"#0B2545":"white",color:active?"white":"#475569",cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,WebkitTapHighlightColor:"transparent"}}>{q.l}</button>;
        })}
        <input type="date" value={filterDate} onChange={e=>setFDate(e.target.value)} style={{padding:"4px 9px",borderRadius:20,border:"1.5px solid #e2e8f0",fontSize:11,color:"#475569",background:"white",flexShrink:0}}/>
        {filterDate&&<button onClick={()=>setFDate("")} style={{padding:"5px 9px",borderRadius:20,border:"none",background:"#fee2e2",color:"#991b1b",cursor:"pointer",fontSize:11,fontWeight:700,flexShrink:0}}>✕</button>}
      </div>}

      <div style={{padding:"7px 13px 110px"}}>
        {/* Role banner */}
        {role==="walikota"&&<div style={{background:"linear-gradient(135deg,#EBF0FA,#dbeafe)",padding:"9px 13px",borderRadius:11,marginBottom:7,border:"1px solid #bfdbfe",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>🔵</span>
          <div><div style={{fontSize:12,fontWeight:700,color:"#0B2545"}}>Rencana Kegiatan Wali Kota</div>
          <div style={{fontSize:10,color:"#475569"}}>{listEvents.length} kegiatan · {pendingList.length} belum dikonfirmasi</div></div>
        </div>}
        {role==="wakilwalikota"&&<div style={{background:"linear-gradient(135deg,#ecfdf5,#d1fae5)",padding:"9px 13px",borderRadius:11,marginBottom:7,border:"1px solid #a7f3d0",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>🟢</span>
          <div><div style={{fontSize:12,fontWeight:700,color:"#065f46"}}>Rencana Kegiatan Wakil Wali Kota</div>
          <div style={{fontSize:10,color:"#475569"}}>{listEvents.length} kegiatan · {pendingList.length} belum dikonfirmasi</div></div>
        </div>}

        {/* FORM */}
        {showForm&&<div style={{background:"white",borderRadius:15,padding:16,marginTop:3,boxShadow:"0 2px 12px rgba(0,0,0,0.08)",border:"1.5px solid #C9A84C",animation:"up 0.25s ease"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <h3 style={{margin:0,color:"#0B2545",fontSize:14,fontWeight:700}}>{editId?"✏️ Edit Jadwal":"➕ Input Jadwal Baru"}</h3>
            {!editId&&<button onClick={()=>setShowAI(true)} style={{padding:"7px 11px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"white",cursor:"pointer",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:13}}>🤖</span>Analisa AI
            </button>}
          </div>
          <div style={{background:"#f0f9ff",borderRadius:8,padding:"8px 10px",marginBottom:11,border:"1px solid #bae6fd",fontSize:11,color:"#0284c7"}}>📋 Alur: <strong>Staf → Kasubbag Protokol → Kabag → Tayang</strong></div>
          <div style={{marginBottom:10}}>
            <label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:3}}>Tanggal *</label>
            <input type="date" value={form.tanggal} onChange={e=>setForm(p=>({...p,tanggal:e.target.value}))} style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",color:"#1e293b",background:"white"}}/>
            {hariForm&&<div style={{marginTop:5,display:"inline-flex",alignItems:"center",gap:5,background:"#EBF0FA",borderRadius:7,padding:"3px 9px"}}>
              <span style={{fontSize:12}}>📅</span><span style={{fontSize:12,fontWeight:700,color:"#0B2545"}}>{hariForm}</span><span style={{fontSize:10,color:"#64748b"}}>· {fmt(form.tanggal)}</span>
            </div>}
          </div>
          <div style={{marginBottom:10}}>
            <label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:3}}>Jam *</label>
            <input type="time" value={form.jam} onChange={e=>setForm(p=>({...p,jam:e.target.value}))} style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",color:"#1e293b",background:"white"}}/>
          </div>
          <div style={{marginBottom:10}}>
            <label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>Jenis Kegiatan</label>
            <div style={{display:"flex",gap:6}}>
              {JENIS.map(j=>{const jc={Sambutan:{bg:"#fdf4ff",a:"#9333ea"},Pengarahan:{bg:"#eff6ff",a:"#2563eb"},Menghadiri:{bg:"#f0fdf4",a:"#16a34a"}}[j];
                return<button key={j} onClick={()=>setForm(p=>({...p,jenisKegiatan:j}))} style={{flex:1,padding:"8px 4px",borderRadius:8,border:`1.5px solid ${form.jenisKegiatan===j?jc.a:"#e2e8f0"}`,background:form.jenisKegiatan===j?jc.bg:"white",color:form.jenisKegiatan===j?jc.a:"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>{j}</button>;
              })}
            </div>
          </div>
          {[{k:"namaAcara",l:"Nama Acara *"},{k:"penyelenggara",l:"Penyelenggara"},{k:"kontak",l:"Kontak"},{k:"buktiUndangan",l:"No. Surat / Undangan"}].map(f=>(
            <div key={f.k} style={{marginBottom:10}}>
              <label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:3}}>{f.l}</label>
              <input type="text" value={form[f.k]||""} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",color:"#1e293b",background:"white"}}/>
            </div>
          ))}
          <div style={{marginBottom:10}}>
            <label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:3}}>Pakaian</label>
            <select value={form.pakaian} onChange={e=>setForm(p=>({...p,pakaian:e.target.value}))} style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",background:"white",color:"#1e293b"}}>
              {PAKAIAN.map(x=><option key={x}>{x}</option>)}
            </select>
          </div>
          <div style={{marginBottom:10}}>
            <label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:3}}>Catatan Penting</label>
            <textarea value={form.catatan} onChange={e=>setForm(p=>({...p,catatan:e.target.value}))} rows={2} style={{width:"100%",padding:"10px 12px",borderRadius:9,border:"1.5px solid #e2e8f0",color:"#1e293b",resize:"vertical",background:"white"}}/>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,color:"#64748b",fontWeight:600,marginBottom:5}}>Untuk Pimpinan</label>
            <div style={{display:"flex",gap:8}}>
              {[{key:"walikota",label:"Wali Kota"},{key:"wakilwalikota",label:"Wakil"}].map(p=>(
                <label key={p.key} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"9px",borderRadius:9,cursor:"pointer",border:form.untukPimpinan.includes(p.key)?"2px solid #0B2545":"2px solid #e2e8f0",background:form.untukPimpinan.includes(p.key)?"#EBF0FA":"white",fontSize:11,fontWeight:700,color:form.untukPimpinan.includes(p.key)?"#0B2545":"#94a3b8"}}>
                  <input type="checkbox" checked={form.untukPimpinan.includes(p.key)} style={{display:"none"}} onChange={e=>{const v=e.target.checked?[...form.untukPimpinan,p.key]:form.untukPimpinan.filter(x=>x!==p.key);setForm(prev=>({...prev,untukPimpinan:v}));}}/>
                  {form.untukPimpinan.includes(p.key)?"☑":"☐"} {p.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setForm(emptyForm);setEditId(null);setTab("jadwal");}} style={{flex:1,padding:"12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",cursor:"pointer",fontSize:12,fontWeight:600,color:"#64748b"}}>Batal</button>
            <button onClick={submit} style={{flex:2,padding:"12px",borderRadius:10,border:"none",background:"#0B2545",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>{editId?"💾 Simpan":"📤 Simpan Draft"}</button>
          </div>
        </div>}

        {/* EVENT LIST */}
        {!showForm&&(listEvents.length===0?(
          <div style={{textAlign:"center",padding:"50px 20px",color:"#94a3b8",animation:"up 0.3s ease"}}>
            <div style={{fontSize:36,marginBottom:9}}>📭</div>
            <div style={{fontSize:14,fontWeight:600}}>Tidak ada jadwal</div>
            <div style={{fontSize:12,marginTop:3}}>{filterDate?`Tidak ada pada ${fmt(filterDate)}`:"Belum ada jadwal"}</div>
            {filterDate&&<button onClick={()=>setFDate("")} style={{marginTop:9,padding:"7px 14px",borderRadius:20,border:"1.5px solid #e2e8f0",background:"white",cursor:"pointer",fontSize:11,fontWeight:600,color:"#475569"}}>Tampilkan Semua</button>}
          </div>
        ):listEvents.map((ev,idx)=>{
          const isExp=expandedId===ev.id;
          const hariEv=getHari(ev.tanggal);
          const conflict=hasConflict(events,ev);
          const isWWKDelegate=role==="wakilwalikota"&&ev.delegasiKeWWK&&!ev.untukPimpinan.includes("wakilwalikota");
          const thColor=role==="walikota"?"#0B2545":role==="wakilwalikota"?"#065f46":"#0B2545";

          return<div key={ev.id} id={"ev-"+ev.id} style={{background:"white",borderRadius:14,marginBottom:8,overflow:"hidden",
            boxShadow:isExp?"0 4px 18px rgba(11,37,69,0.10)":"0 1px 5px rgba(0,0,0,0.06)",
            border:isWWKDelegate?"1.5px solid #10b981":ev.alurHapus?"1.5px solid #fda4af":conflict&&ev.alur==="disetujui"?"1.5px solid #fbbf24":ev.alur==="ditolak"?"1.5px solid #fca5a5":"1.5px solid transparent",
            animation:`up ${0.1+idx*0.03}s ease`}}>

            {isWWKDelegate&&<div style={{background:"#d1fae5",padding:"4px 12px",fontSize:10,color:"#065f46",fontWeight:700}}>🔄 Didelegasi dari Wali Kota</div>}
            {ev.alurHapus&&<div style={{background:"#fff1f2",padding:"4px 12px",fontSize:10,color:"#e11d48",fontWeight:700}}>🗑 Permintaan penghapusan — menunggu {ev.alurHapus==="menunggu_kasubbag"?"Kasubbag":"Kabag"}</div>}
            {conflict&&ev.alur==="disetujui"&&<div style={{background:"#fef3c7",padding:"4px 12px",fontSize:10,color:"#92400e",fontWeight:700}}>⚠️ Jadwal bertabrakan di jam ini</div>}
            {ev.catatanPimpinan&&<div style={{background:"#f0f4ff",padding:"5px 12px",fontSize:11,color:"#3730a3",fontWeight:600,borderBottom:"1px solid #e0e7ff"}}>
              💬 Catatan Pimpinan: {ev.catatanPimpinan}
            </div>}

            <div onClick={()=>setExp(isExp?null:ev.id)} style={{padding:"11px 13px",cursor:"pointer",display:"flex",gap:9,alignItems:"flex-start",WebkitTapHighlightColor:"transparent"}}>
              <div style={{background:thColor,borderRadius:10,padding:"6px 8px",textAlign:"center",flexShrink:0,minWidth:46}}>
                <div style={{color:"#C9A84C",fontSize:8,letterSpacing:1,fontWeight:700}}>{hariEv.slice(0,3).toUpperCase()}</div>
                <div style={{color:"white",fontSize:17,fontWeight:700,lineHeight:1.1}}>{ev.tanggal?new Date(ev.tanggal+"T00:00:00").getDate():"—"}</div>
                <div style={{color:"rgba(255,255,255,0.6)",fontSize:8}}>{ev.tanggal?new Date(ev.tanggal+"T00:00:00").toLocaleDateString("id-ID",{month:"short"}):""}</div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0F2040",lineHeight:1.3,marginBottom:2}}>{ev.namaAcara}</div>
                <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>🕐 {ev.jam} · 🏢 {ev.penyelenggara}</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                  <StatusPill alur={ev.alur} hapus={ev.alurHapus}/>
                  <JenisBadge j={ev.jenisKegiatan}/>
                  <span style={{fontSize:10,padding:"2px 6px",borderRadius:20,background:"#f1f5f9",color:"#475569",fontWeight:600}}>👔 {ev.pakaian}</span>
                  {ev.sambutanFile&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:20,background:"#d1fae5",color:"#065f46",fontWeight:600}}>📄 ✓</span>}
                </div>
              </div>
              <span style={{color:"#cbd5e1",fontSize:13,marginTop:2,flexShrink:0}}>{isExp?"▲":"▼"}</span>
            </div>

            {isExp&&<div style={{borderTop:"1px solid #f8fafc",padding:"12px"}}>
              {!isLeader&&role!=="ajudan"&&role!=="timkom"&&<WorkflowBar alur={ev.alur}/>}
              {ev.alur==="ditolak"&&ev.catatanTolak&&<div style={{background:"#fee2e2",borderRadius:8,padding:"8px 10px",marginBottom:10,fontSize:12,color:"#991b1b"}}><strong>Penolakan:</strong> {ev.catatanTolak}</div>}

              {/* detail */}
              <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:11}}>
                {[{i:"📅",l:"Tanggal",v:`${hariEv}, ${fmt(ev.tanggal)}`},{i:"🕐",l:"Waktu",v:ev.jam+" WIB"},
                  {i:"🏢",l:"Penyelenggara",v:ev.penyelenggara},{i:"📞",l:"Kontak",v:ev.kontak},
                  {i:"📄",l:"Bukti Undangan",v:ev.buktiUndangan},{i:"👔",l:"Pakaian",v:ev.pakaian},
                  {i:"📌",l:"Catatan",v:ev.catatan}].filter(f=>f.v).map(f=>(
                  <div key={f.l} style={{display:"flex",gap:8,padding:"7px 9px",background:"#f8fafc",borderRadius:8}}>
                    <span style={{fontSize:12,flexShrink:0}}>{f.i}</span>
                    <div><div style={{fontSize:8,color:"#94a3b8",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:1}}>{f.l}</div>
                    <div style={{fontSize:12,color:"#1e293b"}}>{f.v}</div></div>
                  </div>
                ))}
                {(ev.perwakilanWK||ev.perwakilanWWK||ev.delegasiKeWWK)&&<div style={{background:"#fef3c7",borderRadius:8,padding:"7px 9px",fontSize:11,color:"#92400e",fontWeight:600}}>
                  {ev.delegasiKeWWK&&!ev.perwakilanWK&&<div>⇄ WK → Wakil Wali Kota</div>}
                  {ev.perwakilanWK&&<div>⇄ WK → {ev.perwakilanWK}</div>}
                  {ev.perwakilanWWK&&<div>⇄ WWK → {ev.perwakilanWWK}</div>}
                </div>}
              </div>

              {/* Sambutan */}
              {(ev.jenisKegiatan==="Sambutan"||ev.sambutanFile||role==="timkom")&&
                <div style={{marginBottom:11}}>
                  <SambutanBlock ev={ev} canUpload={role==="timkom"}
                    onUpload={(f,n)=>{upd(ev.id,{sambutanFile:f,sambutanNama:n});showT("📄 Sambutan diupload ✓");}}
                    onRemove={()=>upd(ev.id,{sambutanFile:null,sambutanNama:""})}/>
                </div>}

              {/* Catatan Pimpinan (leader can write, all can read — already shown in header) */}
              {isLeader&&ev.alur==="disetujui"&&<div style={{marginBottom:11}}>
                <div style={{fontSize:11,fontWeight:700,color:"#3730a3",marginBottom:5}}>💬 Catatan untuk Tim Protokol</div>
                <textarea
                  value={catatanInput[ev.id]!==undefined?catatanInput[ev.id]:(ev.catatanPimpinan||"")}
                  onChange={e=>setCatatanInput(p=>({...p,[ev.id]:e.target.value}))}
                  placeholder="Tulis catatan, arahan, atau permintaan khusus..."
                  rows={2} style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1.5px solid #c7d2fe",fontSize:14,resize:"vertical",background:"#fafafe",color:"#1e293b"}}/>
                <button onClick={()=>{upd(ev.id,{catatanPimpinan:catatanInput[ev.id]??ev.catatanPimpinan});setCatatanInput(p=>({...p,[ev.id]:undefined}));showT("Catatan disimpan & terlihat semua tim ✓");}} style={{marginTop:5,padding:"8px 14px",borderRadius:8,border:"none",background:"#3730a3",color:"white",cursor:"pointer",fontSize:11,fontWeight:700}}>
                  💾 Simpan Catatan
                </button>
              </div>}

              {/* Calendar */}
              {["walikota","wakilwalikota","ajudan"].includes(role)&&ev.alur==="disetujui"&&
                <a href={makeICS(ev)} download={ev.namaAcara+".ics"} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"9px",borderRadius:9,border:"1.5px solid #e2e8f0",background:"white",color:"#334155",textDecoration:"none",fontSize:11,fontWeight:700,marginBottom:11}}>
                  📅 Tambah ke Kalender iOS
                </a>}

              {/* ── STAF ── */}
              {role==="staf"&&<div style={{display:"flex",flexDirection:"column",gap:7}}>
                {(ev.alur==="draft"||ev.alur==="ditolak")&&!ev.alurHapus?<>
                  <button onClick={()=>{upd(ev.id,{alur:"menunggu_kasubbag"});showT("Dikirim ke Kasubbag Protokol ✓");}} style={{padding:"11px",borderRadius:10,border:"none",background:"#0B2545",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>📤 Kirim ke Kasubbag Protokol</button>
                  <div style={{display:"flex",gap:7}}>
                    <button onClick={()=>{setForm({...ev});setEditId(ev.id);setTab("form");setExp(null);}} style={{flex:1,padding:"9px",borderRadius:10,border:"1.5px solid #0B2545",background:"white",color:"#0B2545",cursor:"pointer",fontSize:11,fontWeight:700}}>✏️ Edit</button>
                    <button onClick={()=>{upd(ev.id,{alurHapus:"menunggu_kasubbag"});showT("Permintaan hapus dikirim ke Kasubbag","warn");}} style={{flex:1,padding:"9px",borderRadius:10,border:"1.5px solid #e11d48",background:"white",color:"#e11d48",cursor:"pointer",fontSize:11,fontWeight:700}}>🗑 Minta Hapus</button>
                  </div>
                </>:ev.alur==="disetujui"&&!ev.alurHapus?<>
                  <button onClick={()=>{upd(ev.id,{alurHapus:"menunggu_kasubbag"});showT("Permintaan hapus dikirim ke Kasubbag","warn");}} style={{padding:"9px",borderRadius:10,border:"1.5px solid #e11d48",background:"white",color:"#e11d48",cursor:"pointer",fontSize:11,fontWeight:700}}>🗑 Ajukan Pembatalan/Penghapusan</button>
                </>:<div style={{textAlign:"center",padding:7,color:"#94a3b8",fontSize:11}}>{ev.alurHapus?"Penghapusan menunggu persetujuan":"Sedang diproses"}</div>}
              </div>}

              {/* ── KASUBBAG ── */}
              {role==="kasubbag"&&<div style={{display:"flex",flexDirection:"column",gap:7}}>
                {ev.alur==="menunggu_kasubbag"&&!ev.alurHapus&&<>
                  <button onClick={()=>{upd(ev.id,{alur:"menunggu_kabag"});showT("Diverifikasi → Diteruskan ke Kabag ✓");}} style={{padding:"11px",borderRadius:10,border:"none",background:"#10b981",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>✅ Verifikasi → Teruskan ke Kabag</button>
                  <div style={{borderRadius:10,overflow:"hidden",border:"1.5px solid #fecaca"}}>
                    <textarea placeholder="Catatan penolakan (opsional)..." value={rejectTexts[ev.id]||""} onChange={e=>setRT(p=>({...p,[ev.id]:e.target.value}))} rows={2} style={{width:"100%",padding:"8px 10px",border:"none",resize:"none",color:"#334155",background:"white",fontSize:14}}/>
                    <button onClick={()=>{upd(ev.id,{alur:"ditolak",catatanTolak:rejectTexts[ev.id]||""});showT("Dikembalikan ke Staf","warn");}} style={{width:"100%",padding:"9px",border:"none",background:"#fee2e2",color:"#991b1b",cursor:"pointer",fontSize:11,fontWeight:700}}>✗ Tolak & Kembalikan ke Staf</button>
                  </div>
                </>}
                {ev.alurHapus==="menunggu_kasubbag"&&<>
                  <div style={{background:"#fff1f2",borderRadius:9,padding:"8px 10px",fontSize:12,color:"#e11d48",marginBottom:4}}>⚠️ Staf mengajukan pembatalan jadwal ini</div>
                  <div style={{display:"flex",gap:7}}>
                    <button onClick={()=>{upd(ev.id,{alurHapus:"menunggu_kabag"});showT("Diteruskan ke Kabag untuk persetujuan hapus","warn");}} style={{flex:1,padding:"9px",borderRadius:10,border:"none",background:"#e11d48",color:"white",cursor:"pointer",fontSize:11,fontWeight:700}}>🗑 Setuju → Teruskan Kabag</button>
                    <button onClick={()=>{upd(ev.id,{alurHapus:null});showT("Permintaan hapus dibatalkan");}} style={{flex:1,padding:"9px",borderRadius:10,border:"1.5px solid #94a3b8",background:"white",color:"#334155",cursor:"pointer",fontSize:11,fontWeight:700}}>✗ Tolak Hapus</button>
                  </div>
                </>}
              </div>}

              {/* ── KABAG ── */}
              {role==="kabag"&&<div style={{display:"flex",flexDirection:"column",gap:7}}>
                {ev.alur==="menunggu_kabag"&&!ev.alurHapus&&<>
                  <button onClick={()=>{upd(ev.id,{alur:"disetujui"});showT("Jadwal disetujui & dipublikasi ✓");}} style={{padding:"11px",borderRadius:10,border:"none",background:"#0B2545",color:"white",cursor:"pointer",fontSize:12,fontWeight:700}}>✅ Setujui & Publikasi</button>
                  <div style={{borderRadius:10,overflow:"hidden",border:"1.5px solid #fecaca"}}>
                    <textarea placeholder="Catatan penolakan..." value={rejectTexts[ev.id]||""} onChange={e=>setRT(p=>({...p,[ev.id]:e.target.value}))} rows={2} style={{width:"100%",padding:"8px 10px",border:"none",resize:"none",color:"#334155",background:"white",fontSize:14}}/>
                    <button onClick={()=>{upd(ev.id,{alur:"ditolak",catatanTolak:rejectTexts[ev.id]||""});showT("Ditolak & dikembalikan","warn");}} style={{width:"100%",padding:"9px",border:"none",background:"#fee2e2",color:"#991b1b",cursor:"pointer",fontSize:11,fontWeight:700}}>✗ Tolak & Kembalikan</button>
                  </div>
                </>}
                {ev.alurHapus==="menunggu_kabag"&&<>
                  <div style={{background:"#fff1f2",borderRadius:9,padding:"8px 10px",fontSize:12,color:"#e11d48",marginBottom:4}}>⚠️ Permintaan penghapusan dari Staf (sudah disetujui Kasubbag)</div>
                  <div style={{display:"flex",gap:7}}>
                    <button onClick={()=>{setEvents(p=>p.filter(e=>e.id!==ev.id));setExp(null);showT("Jadwal dihapus oleh Kabag");}} style={{flex:1,padding:"9px",borderRadius:10,border:"none",background:"#e11d48",color:"white",cursor:"pointer",fontSize:11,fontWeight:700}}>🗑 Hapus Permanen</button>
                    <button onClick={()=>{upd(ev.id,{alurHapus:null});showT("Permintaan hapus ditolak Kabag");}} style={{flex:1,padding:"9px",borderRadius:10,border:"1.5px solid #94a3b8",background:"white",color:"#334155",cursor:"pointer",fontSize:11,fontWeight:700}}>✗ Tolak Hapus</button>
                  </div>
                </>}
              </div>}

              {/* ── WALI KOTA ── */}
              {role==="walikota"&&ev.alur==="disetujui"&&ev.untukPimpinan.includes("walikota")&&<div>
                <div style={{fontSize:12,fontWeight:700,color:"#0B2545",marginBottom:7}}>Konfirmasi Kehadiran</div>
                <div style={{display:"flex",gap:7,marginBottom:9}}>
                  {[{s:"hadir",l:"✔ Hadir",c:"#065f46"},{s:"tidak_hadir",l:"✗ Tidak Hadir",c:"#991b1b"}].map(({s,l,c})=>(
                    <button key={s} onClick={()=>{upd(ev.id,{statusWK:s,delegasiKeWWK:false,perwakilanWK:""});showT("Status diperbarui ✓");}} style={{flex:1,padding:"11px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:12,border:`1.5px solid ${c}`,background:ev.statusWK===s?c:"white",color:ev.statusWK===s?"white":c}}>{l}</button>
                  ))}
                </div>
                {ev.statusWK&&<div style={{padding:"6px 10px",borderRadius:7,marginBottom:9,fontSize:11,fontWeight:700,textAlign:"center",background:ev.statusWK==="hadir"?"#d1fae5":"#fee2e2",color:ev.statusWK==="hadir"?"#065f46":"#991b1b"}}>
                  {ev.statusWK==="hadir"?"✔ Hadir dikonfirmasi":"✗ Tidak hadir"}
                </div>}
                <div style={{background:"#f0fdf4",borderRadius:11,padding:11,border:"1.5px solid #bbf7d0",marginBottom:8}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#065f46",marginBottom:6}}>⇄ Disposisi</div>
                  <button onClick={()=>{upd(ev.id,{statusWK:"diwakilkan",delegasiKeWWK:true,perwakilanWK:""});showT("🟢 Muncul di RK Wakil Wali Kota");}}
                    style={{width:"100%",padding:"10px",borderRadius:9,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,marginBottom:6,
                      background:ev.delegasiKeWWK?"#065f46":"#d1fae5",
                      color:ev.delegasiKeWWK?"white":"#065f46",
                      boxShadow:ev.delegasiKeWWK?"0 2px 8px rgba(6,95,70,0.3)":"none"}}>
                    🟢 {ev.delegasiKeWWK?"✓ Didelegasi ke Wakil Wali Kota":"Delegasi ke Wakil Wali Kota"}
                  </button>
                  {ev.delegasiKeWWK&&<button onClick={()=>{upd(ev.id,{statusWK:null,delegasiKeWWK:false,perwakilanWK:""});showT("Delegasi ke WWK dibatalkan","warn");}} style={{width:"100%",padding:"8px",borderRadius:9,border:"1.5px solid #fca5a5",background:"white",color:"#e11d48",cursor:"pointer",fontSize:11,fontWeight:700,marginBottom:6}}>
                    ✕ Batalkan Delegasi ke WWK
                  </button>}
                  <button onClick={()=>setDelegTarget({id:ev.id,side:"wk"})} style={{width:"100%",padding:"9px",borderRadius:9,border:"1.5px solid #94a3b8",background:"white",color:"#334155",cursor:"pointer",fontSize:11,fontWeight:600}}>⇄ Wakilkan ke Pejabat Lain</button>
                  {ev.statusWK==="diwakilkan"&&ev.perwakilanWK&&<>
                    <div style={{marginTop:6,padding:"5px 9px",background:"#fef3c7",borderRadius:7,fontSize:11,color:"#92400e",fontWeight:600}}>⇄ → {ev.perwakilanWK}</div>
                    <button onClick={()=>{upd(ev.id,{statusWK:null,perwakilanWK:"",delegasiKeWWK:false});showT("Disposisi ke pejabat dibatalkan","warn");}} style={{marginTop:5,width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #fca5a5",background:"white",color:"#e11d48",cursor:"pointer",fontSize:10,fontWeight:700}}>✕ Batalkan Disposisi</button>
                  </>}
                </div>
              </div>}

              {/* ── WAKIL WALI KOTA ── */}
              {role==="wakilwalikota"&&ev.alur==="disetujui"&&<div>
                <div style={{fontSize:12,fontWeight:700,color:"#065f46",marginBottom:7}}>Konfirmasi Kehadiran</div>
                <div style={{display:"flex",gap:7,marginBottom:9}}>
                  {[{s:"hadir",l:"✔ Hadir",c:"#065f46"},{s:"tidak_hadir",l:"✗ Tidak Hadir",c:"#991b1b"}].map(({s,l,c})=>(
                    <button key={s} onClick={()=>{upd(ev.id,{statusWWK:s});showT("Status diperbarui ✓");}} style={{flex:1,padding:"11px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:12,border:`1.5px solid ${c}`,background:ev.statusWWK===s?c:"white",color:ev.statusWWK===s?"white":c}}>{l}</button>
                  ))}
                </div>
                {ev.statusWWK&&<div style={{padding:"6px 10px",borderRadius:7,marginBottom:9,fontSize:11,fontWeight:700,textAlign:"center",background:ev.statusWWK==="hadir"?"#d1fae5":"#fee2e2",color:ev.statusWWK==="hadir"?"#065f46":"#991b1b"}}>
                  {ev.statusWWK==="hadir"?"✔ Hadir dikonfirmasi":"✗ Tidak hadir"}
                </div>}
                <div style={{background:"#f8fafc",borderRadius:10,padding:10,border:"1.5px solid #e2e8f0"}}>
                  <div style={{fontSize:11,color:"#64748b",fontWeight:700,marginBottom:6}}>⇄ Wakilkan ke Pejabat Lain</div>
                  <button onClick={()=>setDelegTarget({id:ev.id,side:"wwk"})} style={{width:"100%",padding:"10px",borderRadius:9,cursor:"pointer",fontSize:11,fontWeight:ev.statusWWK==="diwakilkan"?700:600,
                    border:`1.5px solid ${ev.statusWWK==="diwakilkan"?"#0B2545":"#94a3b8"}`,
                    background:ev.statusWWK==="diwakilkan"?"#EBF0FA":"white",
                    color:ev.statusWWK==="diwakilkan"?"#0B2545":"#334155"}}>
                    {ev.statusWWK==="diwakilkan"&&ev.perwakilanWWK?`✓ → ${ev.perwakilanWWK}`:"Pilih Pejabat Perwakilan"}
                  </button>
                  {ev.statusWWK==="diwakilkan"&&ev.perwakilanWWK&&<button onClick={()=>{upd(ev.id,{statusWWK:null,perwakilanWWK:""});showT("Disposisi dibatalkan","warn");}} style={{marginTop:5,width:"100%",padding:"7px",borderRadius:8,border:"1.5px solid #fca5a5",background:"white",color:"#e11d48",cursor:"pointer",fontSize:10,fontWeight:700}}>✕ Batalkan Disposisi</button>}
                </div>
              </div>}
            </div>}
          </div>;
        }))}
      </div>

      {/* FAB */}
      {role==="staf"&&tab==="jadwal"&&<button onClick={()=>{setTab("form");setForm(emptyForm);setEditId(null);}} style={{position:"fixed",bottom:28,right:16,width:52,height:52,borderRadius:"50%",background:"linear-gradient(135deg,#0B2545,#1B4080)",color:"white",border:"none",fontSize:26,cursor:"pointer",boxShadow:"0 6px 18px rgba(11,37,69,0.4)",display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",zIndex:50,transition:"transform 0.15s"}}
        onTouchStart={e=>e.currentTarget.style.transform="scale(0.9)"}
        onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>＋</button>}
    </div>
  );
}
