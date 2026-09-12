The admin list table. Header row is sunken grey with uppercase micro-labels; body rows are separated by hairlines, never zebra-striped. Pair with `Pagination` in a `Card`.

```jsx
<DataTable
  columns={[
    { header: '#', key: 'i' },
    { header: 'Order ID', key: 'id', strong: true },
    { header: 'Payment', cell: r => <Badge tone="success">{r.pay}</Badge> },
    { header: 'Action', align: 'right', cell: () => <Button size="sm" variant="outlineNavy">View</Button> }
  ]}
  rows={orders}
/>
```
