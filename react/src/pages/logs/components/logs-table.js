import React from 'react'
import Table, {
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from 'material-ui/Table'
import { withStyles } from 'material-ui/styles'

const styles = theme => ({
  table: {
    background: theme.palette.background.default
  }
})

function LogsTable({ history, logs, classes }) {
  const timeFormatter = Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  })
  const openLog = logId => {
    history.push(`/logs/${logId}`)
  }
  const toTableRow = log => {
    const timeString = timeFormatter.format(new Date(log.StartTime))
    return (
      <TableRow hover onClick={() => openLog(log.Id)} key={log.Id}>
        <TableCell>{timeString}</TableCell>
        <TableCell>{log.Operation}</TableCell>
        <TableCell>{log.Status}</TableCell>
        <TableCell>{log.LogUser.Name}</TableCell>
        <TableCell>{log.DurationMilliseconds + 'ms'}</TableCell>
        <TableCell>{`${(log.LogLength / 1000).toFixed(2)} k`}</TableCell>
      </TableRow>
    )
  }

  return (
    <Table className={classes.table}>
      <TableHead>
        <TableRow>
          <TableCell>Time</TableCell>
          <TableCell>Operation</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>User</TableCell>
          <TableCell>Run Duration</TableCell>
          <TableCell>Length</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>{Object.values(logs).map(toTableRow)}</TableBody>
    </Table>
  )
}

export default withStyles(styles)(LogsTable)
