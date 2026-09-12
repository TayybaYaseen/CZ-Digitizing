The dashboard's Revenue Overview chart. One gold series, hairline gridlines, no legend — never add a second series or a coloured background.

```jsx
<LineChart height={260} valueFormat={v => '$' + Math.round(v / 1000) + 'k'}
  data={[{label:'Jan',value:22400},{label:'Feb',value:28100}]} />
```
