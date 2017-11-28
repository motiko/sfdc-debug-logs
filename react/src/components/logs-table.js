import React from 'react'
import {
  Table,
  TableBody,
  TableFooter,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn
} from 'material-ui/Table'

export default function LogsTable(props) {
  function openLog(index) {
    props.history.push(`/logs/${props.logs[index].Id}`)
  }

  const toLogView = (log, index) => {
    const style = {
      display: log['not_matches_search']
        ? 'none'
        : 'table-row'
    }
    const timeString = log.StartTime.match(/T(\d\d:\d\d):/)[1]
    return (<TableRow key={log.Id} logid={log.Id} style={style}>
      <TableRowColumn>{timeString}</TableRowColumn>
      <TableRowColumn>{log.Operation}</TableRowColumn>
      <TableRowColumn>{log.Status}</TableRowColumn>
      <TableRowColumn>{log.LogUser.Name}</TableRowColumn>
      <TableRowColumn>{log.DurationMilliseconds + "ms"}</TableRowColumn>
      <TableRowColumn>{`${log.LogLength / 1000} k`}</TableRowColumn>
    </TableRow>)
  }

  return (<Table onRowSelection={openLog}>
    <TableHeader adjustForCheckbox={false} displaySelectAll={false}>
      <TableRow>
        <TableHeaderColumn >Time</TableHeaderColumn>
        <TableHeaderColumn >Operation</TableHeaderColumn>
        <TableHeaderColumn >Status</TableHeaderColumn>
        <TableHeaderColumn >User</TableHeaderColumn>
        <TableHeaderColumn >Run Duration</TableHeaderColumn>
        <TableHeaderColumn >Length</TableHeaderColumn>
      </TableRow>
    </TableHeader>
    <TableBody showRowHover={true} displayRowCheckbox={false}>
      {props.logs.map(toLogView)}
    </TableBody>
  </Table>)
}
