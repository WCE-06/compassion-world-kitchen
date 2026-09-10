"use client";

import { useEffect, useState } from "react";

type TaskEvent={id:string;title:string;calls:string[];equipment:string;expectedSeconds:number;action:"COMPLETE"|"UNDO";createdAt:number;intervalSeconds:number|null;overrunSeconds:number|null};
type Analytics={summary:{completed:number;measured:number;delayed:number;onTime:number};events:TaskEvent[]};

function duration(seconds:number|null){if(seconds===null)return"計測開始";const value=Math.abs(seconds),minutes=Math.floor(value/60),rest=value%60;return`${minutes?`${minutes}分`:""}${rest?`${rest}秒`:minutes?"":"0秒"}`}

export default function TaskAnalytics(){
  const [data,setData]=useState<Analytics|null>(null),[message,setMessage]=useState("工程実績を読み込んでいます…");
  async function load(){try{const response=await fetch("/api/v1/kitchen/task-analytics",{cache:"no-store"}),body=await response.json();if(!response.ok)throw new Error(body.error??"取得できませんでした");setData(body);setMessage("")}catch{setMessage("工程実績を取得できませんでした")}}
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),15000);return()=>window.clearInterval(timer)},[]);
  const completed=data?.events.filter(event=>event.action==="COMPLETE")??[];
  return <section className="analytics-workspace"><div className="workspace-head"><div><p>KITCHEN PERFORMANCE</p><h1>本日の工程実績</h1><small>最短工程ナビの完了間隔から、時間のかかった工程を確認できます</small></div><button onClick={()=>void load()}>再読み込み</button></div>
    {data&&<div className="analytics-summary"><article><span>完了した工程</span><b>{data.summary.completed}</b></article><article><span>予定内</span><b>{data.summary.onTime}</b></article><article className={data.summary.delayed?"warning":""}><span>1分超過</span><b>{data.summary.delayed}</b></article></div>}
    {message?<p className="analytics-empty">{message}</p>:completed.length?<div className="analytics-list">{completed.map(event=>{const delayed=(event.overrunSeconds??0)>60;return <article key={event.id} className={delayed?"delayed":""}><time>{new Date(event.createdAt).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</time><div><small>{event.equipment}{event.calls.length?`・${event.calls.join(" / ")}`:""}</small><b>{event.title}</b></div><div className="analytics-time"><span>前工程から {duration(event.intervalSeconds)}</span>{event.overrunSeconds!==null&&<strong className={delayed?"late":"ontime"}>{event.overrunSeconds>60?`目安より +${duration(event.overrunSeconds)}`:"予定内"}</strong>}</div></article>})}</div>:<p className="analytics-empty">本日完了した工程はまだありません</p>}
    <p className="analytics-note">※「前工程から」は完了ボタン同士の間隔です。並行作業を含むため、単体の加熱時間ではなくボトルネック発見の目安として使用します。</p>
  </section>;
}
