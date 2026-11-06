import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../services/api';
import { PageHead, Empty } from '../components/common/UI';
const fmt = (value) => value ? new Date(value).toLocaleString() : '—';
export default function Dashboard(){
 const [data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{api('/dashboard').then(setData).catch(e=>setError(e.message));},[]);
 return <><PageHead eyebrow="DASHBOARD" title="Good day, Administrator" desc="Here is the latest activity across student events and attendance."/><div className="stats-grid">{[['Total students',data?.stats.students,'Users'],['Active students',data?.stats.activeStudents,'ShieldCheck'],['Active events',data?.stats.events,'CalendarDays'],['Attendance today',data?.stats.todayAttendance,'Clock3']].map(([label,value],i)=><div className="stat-card" key={label}><span>{label}</span><strong>{value??'—'}</strong><small>{['Registered records','Eligible for attendance','Scheduled or completed','Time-in records today'][i]}</small></div>)}</div><section className="panel"><div className="panel-head"><div><h2>Recent attendance</h2><p className="muted">Latest recorded student activity</p></div><NavLink className="text-link" to="/attendance">View all</NavLink></div>{error?<div className="error">{error}</div>:!data?<Empty text="Loading dashboard…"/>:data.recent.length===0?<Empty text="No attendance has been recorded yet."/>:<div className="table-wrap"><table><thead><tr><th>Student</th><th>Event</th><th>Time in</th><th>Time out</th></tr></thead><tbody>{data.recent.map(r=><tr key={r._id}><td><b>{r.student?.firstName} {r.student?.lastName}</b><small>{r.student?.studentNumber}</small></td><td>{r.event?.title}</td><td>{fmt(r.timeIn)}</td><td>{fmt(r.timeOut)}</td></tr>)}</tbody></table></div>}</section></>;
}
