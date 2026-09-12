Navy admin sidebar, gold active pill. Keep the visible set short — group items with `{ section }` rows rather than listing every screen.

```jsx
<SidebarNav value={view} onChange={setView}
  header={<div style={{padding:16}}><Logo variant="dark" height={34} /></div>}
  items={[
    { section: 'Main' },
    { value: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
    { value: 'orders', label: 'Orders', icon: 'package' },
    { section: 'System' },
    { value: 'settings', label: 'Settings', icon: 'settings' }
  ]} />
```
