import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import { openLog } from '../../../hash-route'

const timeFormatter = Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hour12: false
})

// The log list (#/); a click opens the log.
export default function LogsTable({ logs }) {
  return (
    <Table sx={{ bgcolor: 'background.default' }}>
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
      <TableBody>
        {logs.map(log => (
          <TableRow
            hover
            onClick={() => openLog(log.Id)}
            key={log.Id}
            sx={{ cursor: 'pointer' }}
          >
            <TableCell>
              {timeFormatter.format(new Date(log.StartTime))}
            </TableCell>
            <TableCell>{log.Operation}</TableCell>
            <TableCell>{log.Status}</TableCell>
            <TableCell>{log.LogUser.Name}</TableCell>
            <TableCell>{log.DurationMilliseconds + 'ms'}</TableCell>
            <TableCell>{`${(log.LogLength / 1000).toFixed(2)} k`}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
