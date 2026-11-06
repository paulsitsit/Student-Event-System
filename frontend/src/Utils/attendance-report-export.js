import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AlignmentType, BorderStyle, Document, ImageRun, Packer,
  Paragraph, Table, TableCell, TableRow, TextRun, WidthType, VerticalAlign,
} from 'docx';

const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-PH', {year:'numeric',month:'long',day:'numeric'}) : '';
const fmtTime = (v) => v ? new Date(v).toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'}) : '';
const ordinal = (v) => v ? `${v}${v==='1'?'st':v==='2'?'nd':v==='3'?'rd':'th'} Year` : '';
const classLabel = (f={}) => [f.course,ordinal(f.yearLevel),f.section?`Section ${f.section}`:''].filter(Boolean).join(' ') || 'All Courses / Year Levels / Sections';
const fullName = (s) => `${s?.lastName||''}, ${s?.firstName||''}`.trim().replace(/^,\s*/, '');

function rowsFor(data) {
  const byStudent = new Map();
  (data.attendance||[]).forEach(r => {
    const id = r.student?._id || r.student;
    if (id) byStudent.set(String(id),r);
  });
  return (data.students||[]).map((s,i) => {
    const r = byStudent.get(String(s._id));
    const tin = r?.timeIn ? new Date(r.timeIn) : null;
    const tout = r?.timeOut ? new Date(r.timeOut) : null;
    const pm = tin && tin.getHours() >= 12;
    return {
      no:i+1,id:s.studentNumber||'',name:fullName(s),
      amIn:tin&&!pm?fmtTime(tin):'',amOut:tout&&!pm?fmtTime(tout):'',
      pmIn:tin&&pm?fmtTime(tin):'',pmOut:tout&&pm?fmtTime(tout):'',
    };
  });
}
function baseName(data) {
  return `${(data.event?.title||'event').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-attendance`;
}
function save(blob,name) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function detailRows(data) {
  return [
    ['Name of Event',data.event?.title||''],
    ['Course & Year Section',classLabel(data.filters)],
    ['Date',fmtDate(data.event?.startsAt)],
    ['Venue',data.event?.venue||''],
  ];
}

export function exportAttendanceCsv(data) {
  const q=v=>`"${String(v??'').replaceAll('"','""')}"`;
  const lines=[
    ...detailRows(data).map(r=>r.map(q).join(',')),
    [],
    ['No.','Student ID #','Student Name','AM Time In','AM Time Out','PM Time In','PM Time Out'].map(q).join(','),
    ...rowsFor(data).map(r=>[r.no,r.id,r.name,r.amIn,r.amOut,r.pmIn,r.pmOut].map(q).join(',')),
  ];
  save(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),`${baseName(data)}.csv`);
}

function loadImage(url) {
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);resolve(c.toDataURL('image/jpeg',.95));};
    img.onerror=reject;img.src=url;
  });
}

export async function exportAttendancePdf(data,logoUrl) {
  const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const w=pdf.internal.pageSize.getWidth(),logo=await loadImage(logoUrl);
  const title=String(data.event?.title||'EVENT').toUpperCase();
  const drawTop=()=>{
    pdf.setDrawColor(7,93,50);pdf.setLineWidth(1);pdf.rect(5,5,w-10,200);
    pdf.addImage(logo,'JPEG',9,8,w-18,34);
    pdf.setFillColor(7,93,50);pdf.rect(52,45,w-104,15,'F');
    pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(17);
    pdf.text(title,w/2,52,{align:'center'});
    pdf.setFont('helvetica','italic');pdf.setFontSize(9);pdf.text('Event Attendance',w/2,58,{align:'center'});
    pdf.setTextColor(0,0,0);pdf.setFont('helvetica','bold');pdf.setFontSize(9);
    pdf.text('Name of Event :',13,72);pdf.text('Course & Year Section :',13,82);
    pdf.text('Date :',w/2+3,72);pdf.text('Venue :',w/2+3,82);
    pdf.setFont('times','bold');pdf.setFontSize(10);
    pdf.text(String(data.event?.title||''),52,72);pdf.text(classLabel(data.filters),64,82);
    pdf.text(fmtDate(data.event?.startsAt),w/2+24,72);pdf.text(String(data.event?.venue||''),w/2+24,82);
    pdf.setDrawColor(0);pdf.setLineWidth(.25);
    pdf.line(51,74,w/2-8,74);pdf.line(63,84,w/2-8,84);
    pdf.line(w/2+23,74,w-13,74);pdf.line(w/2+23,84,w-13,84);
  };
  drawTop();
  const dataRows=rowsFor(data);
  autoTable(pdf,{
    startY:91,
    head:[
      [{content:'No.',rowSpan:2},{content:'Student ID #',rowSpan:2},{content:'Student Name',rowSpan:2},{content:'AM',colSpan:2},{content:'PM',colSpan:2}],
      ['Time In','Time Out','Time In','Time Out']
    ],
    body:(dataRows.length?dataRows:[{no:'',id:'',name:'',amIn:'',amOut:'',pmIn:'',pmOut:''}]).map(r=>[r.no,r.id,r.name,r.amIn,r.amOut,r.pmIn,r.pmOut]),
    theme:'grid',margin:{left:9,right:9,bottom:13},
    styles:{fontSize:8,cellPadding:2.2,minCellHeight:9,lineColor:[0,0,0],lineWidth:.25,textColor:[0,0,0]},
    headStyles:{fillColor:[7,93,50],textColor:[255,255,255],fontStyle:'bold',halign:'center',valign:'middle'},
    columnStyles:{0:{cellWidth:13,halign:'center'},1:{cellWidth:42,halign:'center'},2:{cellWidth:75},3:{halign:'center'},4:{halign:'center'},5:{halign:'center'},6:{halign:'center'}},
    didDrawPage:()=>{
      if(pdf.internal.getCurrentPageInfo().pageNumber>1) drawTop();
      const n=pdf.internal.getCurrentPageInfo().pageNumber;
      pdf.setFontSize(7);pdf.setTextColor(80,95,80);
      pdf.text('Passi City College • Student Event Attendance System',10,204);
      pdf.text(`Page ${n}`,w-10,204,{align:'right'});
    }
  });
  pdf.save(`${baseName(data)}.pdf`);
}

function cell(text,{header=false,center=false,bold=false,columnSpan=1}={}) {
  return new TableCell({
    columnSpan,
    verticalAlign:VerticalAlign.CENTER,
    shading:header?{fill:'075D32'}:undefined,
    margins:{top:85,bottom:85,left:85,right:85},
    borders:Object.fromEntries(['top','bottom','left','right'].map(k=>[k,{style:BorderStyle.SINGLE,size:6,color:'222222'}])),
    children:[new Paragraph({
      alignment:center?AlignmentType.CENTER:AlignmentType.LEFT,
      children:[new TextRun({text:String(text??''),bold:header||bold,color:header?'FFFFFF':'111111',size:header?18:17})]
    })]
  });
}

export async function exportAttendanceWord(data,logoUrl) {
  const logo=await fetch(logoUrl).then(r=>r.arrayBuffer());
  const rows=rowsFor(data);
  const tableRows=[
    new TableRow({children:[
      cell('No.',{header:true,center:true}),cell('Student ID #',{header:true,center:true}),
      cell('Student Name',{header:true,center:true}),cell('AM',{header:true,center:true,columnSpan:2}),
      cell('PM',{header:true,center:true,columnSpan:2})
    ]}),
    new TableRow({children:[
      cell('',{header:true}),cell('',{header:true}),cell('',{header:true}),
      cell('Time In',{header:true,center:true}),cell('Time Out',{header:true,center:true}),
      cell('Time In',{header:true,center:true}),cell('Time Out',{header:true,center:true})
    ]}),
    ...rows.map(r=>new TableRow({children:[
      cell(r.no,{center:true}),cell(r.id,{center:true}),cell(r.name),
      cell(r.amIn,{center:true}),cell(r.amOut,{center:true}),
      cell(r.pmIn,{center:true}),cell(r.pmOut,{center:true})
    ]}))
  ];
  const meta=(label,value)=>new Paragraph({spacing:{after:90},children:[
    new TextRun({text:`${label}: `,bold:true,size:20}),new TextRun({text:String(value||''),size:20})
  ]});
  const doc=new Document({sections:[{
    properties:{page:{size:{width:16838,height:11906,orientation:'landscape'},margin:{top:500,right:500,bottom:500,left:500}}},
    children:[
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:120},children:[
        new ImageRun({data:logo,transformation:{width:970,height:150}})
      ]}),
      new Paragraph({alignment:AlignmentType.CENTER,shading:{fill:'075D32'},spacing:{after:80},children:[
        new TextRun({text:String(data.event?.title||'EVENT').toUpperCase(),bold:true,color:'FFFFFF',size:32})
      ]}),
      new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:150},children:[
        new TextRun({text:'Event Attendance',bold:true,italics:true,color:'075D32',size:22})
      ]}),
      meta('Name of Event',data.event?.title),
      meta('Course & Year Section',classLabel(data.filters)),
      meta('Date',fmtDate(data.event?.startsAt)),
      meta('Venue',data.event?.venue),
      new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:tableRows}),
      new Paragraph({alignment:AlignmentType.RIGHT,spacing:{before:150},children:[
        new TextRun({text:'Passi City College • Student Event Attendance System',size:14,color:'526352'})
      ]})
    ]
  }]});
  save(await Packer.toBlob(doc),`${baseName(data)}.docx`);
}
