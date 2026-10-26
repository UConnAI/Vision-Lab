function csvRecords(text){
  const records=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(char==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(char===','&&!quoted){row.push(field);field='';}
    else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(cell=>cell.trim()))records.push(row);row=[];field='';}
    else field+=char;
  }
  if(quoted)throw new Error('A quoted CSV field was not closed.');
  row.push(field);if(row.some(cell=>cell.trim()))records.push(row);
  return records;
}
export function parsePositions(text){
  const rows=csvRecords(text.replace(/^\uFEFF/,'')),header=rows.shift()?.map(value=>value.trim())||[];
  for(const name of ['Frame','Visibility','X','Y'])if(!header.includes(name))throw new Error(`Missing CSV column: ${name}.`);
  const result=new Map();
  for(const [index,cells] of rows.entries()){
    const row=Object.fromEntries(header.map((name,i)=>[name,(cells[i]??'').trim()]));
    const frame=Number(row.Frame),visibility=Number(row.Visibility);
    if(!/^\d+$/.test(row.Frame)||!Number.isInteger(frame)||frame<0||!['0','1'].includes(row.Visibility))throw new Error(`CSV row ${index+2}: use a nonnegative whole Frame and Visibility 0 or 1.`);
    if(result.has(frame))throw new Error(`Duplicate Frame ${frame}.`);
    const x=Number(row.X),y=Number(row.Y);
    if(visibility&&(!row.X||!row.Y||!Number.isFinite(x)||!Number.isFinite(y)))throw new Error(`Frame ${frame}: visible X and Y must be finite numbers.`);
    result.set(frame,{visible:visibility===1,x:visibility?x:null,y:visibility?y:null,source:row.Source||'csv'});
  }
  return result;
}
