Pill label for statuses, plan flags and counts.

```jsx
<Badge tone="success" dot>Active</Badge>
<Badge tone="warning">Pending</Badge>
<Badge tone="gold" size="sm">Most Popular</Badge>
```

Status mapping from the admin panel: Paid/Completed/Published/Approved → `success`; Pending/Processing payment/Draft-review → `warning`; Rejected/Cancelled/Failed → `danger`; In Progress → `info`; Draft → `neutral`.
