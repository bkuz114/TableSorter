# TableSorter

A lightweight, vanilla JavaScript class for adding sortable functionality to HTML tables. Zero dependencies, ~5KB minified, and designed for readability and maintainability.

## Why Another Table Sorter?

I've used several table sorting libraries over the years, and consistently ran into the same issues:
- **Over-engineered** with dozens of configuration options I never needed
- **Tied to specific CSS frameworks**, making styling a nightmare
- **Poorly documented code** that became impossible to debug when something went wrong
- **Magic class injection** that left me guessing where styles were coming from

TableSorter takes a different approach:
- **Explicit configuration** via HTML data attributes (what you see is what you get)
- **Minimal JS-injected classes** (just `.sortable` for CSS convenience, clearly documented)
- **Heavily commented code**—you can actually read it and understand how it works
- **Extensible by design** (add custom comparators without touching core)
- **Graceful degradation** (one bad table doesn't break others)

## Quick Start

1. Include the files:
   ```html
   <link rel="stylesheet" href="src/tableSorter.css">
   <script src="src/TableSorter.js"></script>
   ```

2. Add `data-sortable` to your table and `data-sort-type` to each header:
   ```html
   <table data-sortable>
     <thead>
       <tr>
         <th data-sort-type="string">Vegetable</th>
         <th data-sort-type="number">Price</th>
         <th data-sort-type="range-number">Cook Time</th>
         <th data-sortable="false">Notes</th>
       </tr>
     </thead>
     <tbody>
       <!-- your data -->
     </tbody>
   </table>
   ```

3. That's it. Tables are automatically initialized on page load.

## Live Demo

See [`demo.html`](demo.html) for working examples, including:
- Basic string/number/range sorting
- Custom comparators (emoji-based cook times)
- Non-sortable columns
- Manual initialization

## Documentation

### HTML Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| `data-sortable` | (On `<table>`) Enables sorting | `<table data-sortable>` |
| `data-sort-type` | (On `<th>`) Sets column sort behavior | `data-sort-type="number"` |
| `data-sortable="false"` | (On `<th>`) Explicitly disable sorting | `<th data-sortable="false">` |

### Built-in Sort Types

- `string` - Case-insensitive alphabetical
- `string-case-sensitive` - Case-sensitive alphabetical
- `number` - Numeric (extracts first number, invalid values go to bottom)
- `range-number` - For ranges like "4-5" (sorts by first number)
- `custom` - Use with registered comparator (see below)

### Custom Comparators

Register your own sorting logic:

```javascript
TableSorter.registerComparator('emoji-time', (a, b) => {
  const extractMinutes = (str) => {
    const match = str.match(/\d+/);
    return match ? parseInt(match[0], 10) : Infinity;
  };
  return extractMinutes(a) - extractMinutes(b);
});
```

Then use it in your HTML:
```html
<th data-sort-type="custom" data-sort-custom="emoji-time">Cook Time</th>
```

### Manual Initialization

For dynamically added tables or programmatic control:

```javascript
const table = document.getElementById('my-table');
const sorter = new TableSorter(table);

// Programmatic sorting
sorter.sort(0, true);  // Sort column 0 ascending
sorter.sort(2, false); // Sort column 2 descending
sorter.reset();        // Restore original order
```

### CSS Customization

The JS adds three classes you can style:
- `.sortable` - All sortable headers (injected by JS for CSS convenience)
- `.sort-asc` - Currently sorted ascending
- `.sort-desc` - Currently sorted descending

The included `tableSorter.css` provides basic styling with Unicode arrows. Customize or replace it entirely.

## Project Structure

```
TableSorter/
├── src/
│   ├── TableSorter.js      # Main class (heavily commented)
│   └── tableSorter.css      # Basic styling
├── demo.html                # Working examples
└── README.md
```

## Philosophy

- **Readability over cleverness** - Code should be understandable at first glance
- **Explicit over implicit** - Data attributes make configuration visible
- **Progressive enhancement** - Tables work without JS, get better with it
- **Maintainable > "Complete"** - Easy to modify for your specific needs

## License

GNU License - Free to use, modify, and distribute. If you improve it, consider sharing back.

## Contributing

Found a bug? Have an idea? Open an issue or submit a pull request. 

This code prioritizes readability and maintainability over clever solutions. 
If you contribute, please maintain the same level of documentation and 
thoughtful error handling you see here.

---

**Questions?** Open an issue or reach out. This utility was built for real projects, not as an academic exercise.
