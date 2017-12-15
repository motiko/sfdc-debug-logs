import React from 'react'
import Table, {
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from 'material-ui/Table'

export default function LogsTable ({history, logs}) {
  function openLog (logId) {
    history.push(`/logs/${logId}`)
  }

  const toLogView = (log) => {
    const style = {
      display: log['not_matches_search']
        ? 'none'
        : 'table-row'
    }
    const timeString = log.StartTime.match(/T(\d\d:\d\d):/)[1]
    return (<TableRow hover onClick={() => openLog(log.Id)} key={log.Id} style={style}>
      <TableCell>{timeString}</TableCell>
      <TableCell>{log.Operation}</TableCell>
      <TableCell>{log.Status}</TableCell>
      <TableCell>{log.LogUser.Name}</TableCell>
      <TableCell>{log.DurationMilliseconds + 'ms'}</TableCell>
      <TableCell>{`${log.LogLength / 1000} k`}</TableCell>
    </TableRow>)
  }

  return (<Table >
    <TableHead >
      <TableRow>
        <TableCell >Time</TableCell>
        <TableCell >Operation</TableCell>
        <TableCell >Status</TableCell>
        <TableCell >User</TableCell>
        <TableCell >Run Duration</TableCell>
        <TableCell >Length</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {Object.values(logs).map(toLogView)}
    </TableBody>
  </Table>)
}
