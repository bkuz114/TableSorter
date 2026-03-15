/**
 * TableSorter - A vanilla JavaScript class for adding sortable functionality to HTML tables.
 * 
 * Features:
 * - Opt-in via data-sortable attribute on <table>
 * - Column configuration via data-sort-type on <th> (string, string-case-sensitive, number, range-min, range-max)
 * - Optional data-sort-type-desc on <th> allows for different comparator on descending vs ascending sort
 * - Extensible comparator registry for custom sort logic
 * - Visual state classes: .sort-asc, .sort-desc (JS adds .sortable to headers for CSS convenience)
 * - Graceful error handling with console warnings
 * - Auto-initializes on DOMContentLoaded, but can also be instantiated manually
 * 
 * CSS Contract:
 * - .sortable { cursor: pointer; } (add your own styling)
 * - .sort-asc::after, .sort-desc::after for sort indicators
 * - Styling for sortable but inactive headers is optional (e.g., .sortable:not(.sort-asc):not(.sort-desc)::after)
 * 
 * @author Your Name
 * @version 1.0.0
 */

/**
 * USAGE EXAMPLES:
 * 
 * 1. Basic setup (auto-initialization):
 *    <table data-sortable>
 *      <thead>
 *        <tr>
 *          <th data-sort-type="string">Vegetable</th>
 *          <th data-sort-type="number">Price</th>
 *          <th data-sort-type="range-min">Cook Time</th>
 *          <th data-sortable="false">Notes</th>
 *        </tr>
 *      </thead>
 *      <tbody>...</tbody>
 *    </table>
 * 
 * 2. Manual initialization:
 *    const table = document.getElementById('my-table');
 *    const sorter = new TableSorter(table);
 * 
 * 3. Custom comparator:
 *    // Register a custom comparator
 *    TableSorter.registerComparator('emoji-time', (a, b) => {
 *      const extractMinutes = (str) => {
 *        const match = str.match(/\d+/);
 *        return match ? parseInt(match[0], 10) : Infinity;
 *      };
 *      return extractMinutes(a) - extractMinutes(b);
 *    });
 * 
 *    // Use it in HTML
 *    <th data-sort-type="emoji-time">Cook Time</th>
 * 
 * 4. Programmatic control:
 *    const sorter = new TableSorter(table);
 *    sorter.sort(0, true);  // Sort column 0 ascending
 *    sorter.sort(2, false); // Sort column 2 descending
 *    sorter.reset();        // Restore original order
 * 
 * 5. CSS styling (add to your stylesheet):
 *    th.sortable { cursor: pointer; }
 *    th.sort-asc::after { content: " ▲"; }
 *    th.sort-desc::after { content: " ▼"; }
 *    th.sortable:not(.sort-asc):not(.sort-desc)::after {
 *      content: " ⇅";
 *      opacity: 0.5;
 *    }
 */

(function(global) {
    'use strict';

    /**
     * Static registry of built-in comparators.
     * Each comparator receives two cell values (as strings) and returns:
     *   - negative if a < b
     *   - positive if a > b
     *   - zero if equal
     */
    const BUILT_IN_COMPARATORS = {
        /**
         * Case-insensitive string comparison.
         */
        string: (a, b) => String(a).toLowerCase().localeCompare(String(b).toLowerCase()),

        /**
         * Case-sensitive string comparison.
         */
        'string-case-sensitive': (a, b) => String(a).localeCompare(String(b)),

        /**
         * Numeric comparison. Non-numeric or empty values are pushed to the bottom (Infinity).
         * Logs a warning for non-empty cells that fail parsing.
         */
        number: (a, b) => {
            const numA = _parseNumber(a);
            const numB = _parseNumber(b);
            return (numA - numB);
        },

        /**
         * Range number comparison. Extracts the first number from strings like "4-5" or "4–5 minutes".
         * Non-numeric or empty values are pushed to the bottom (Infinity).
         * Logs a warning for non-empty cells that fail parsing.
         */
        'range-min': (a, b) => {
            const numA = _parseRangeNumber(a);
            const numB = _parseRangeNumber(b);
            return (numA - numB);
        },


        /**
         * Range number comparison. Extracts the second number from strings like "4-5" or "4–5 minutes".
         * Non-numeric or empty values are pushed to the bottom (Infinity).
         * Logs a warning for non-empty cells that fail parsing.
         */
        'range-max': (a, b) => {
            const numA = _parseRangeNumber(a, true);
            const numB = _parseRangeNumber(b, true);
            return (numA - numB);
        }
    };

    /**
     * Helper: Parse a number from a cell value.
     * Returns Infinity for unparseable values (except empty cells, which return Infinity silently).
     * @param {string} val - The cell text content
     * @returns {number} Parsed number or Infinity
     * @private
     */
    function _parseNumber(val) {
        const str = String(val).trim();
        if (str === '') return Infinity; // Empty cells: bottom, no warning

        const num = parseFloat(str);
        if (isNaN(num)) {
            console.warn(`TableSorter: Could not parse value as number: "${str}"`);
            return Infinity;
        }
        return num;
    }

    /**
     * Helper: Parse either first or second number from a range string.
     * Returns Infinity for unparseable values (except empty cells, which return Infinity silently).
     * @param {string} val - The cell text content
     * @param {boolean} getMax - true if want second number, false if want first
     * @returns {number} First number found or Infinity
     * @private
     */
    function _parseRangeNumber(val, getMax = false) {
        const str = String(val).trim();
        if (str === '') return Infinity; // Empty cells: bottom, no warning

        const matches = str.match(/\d+/g);
        if (!matches) {
            console.warn(`TableSorter: Could not parse range number from: "${str}"`);
            return Infinity;
        }

        const min = parseInt(matches[0], 10);
        // If only one number, min and max are the same
        const max = matches.length > 1 ? parseInt(matches[1], 10) : min;

        if (getMax) {
            return max;
        }
        return min;
    }

    /**
     * TableSorter class.
     * @param {HTMLTableElement} tableElement - The table to make sortable
     */
    global.TableSorter = class TableSorter {
        /**
         * Registered custom comparators.
         * @type {Object.<string, Function>}
         */
        static customComparators = {};

        /**
         * Register a custom comparator.
         * @param {string} name - Unique identifier for the comparator
         * @param {Function} fn - Comparator function (a, b) => number
         */
        static registerComparator(name, fn) {
            if (typeof fn !== 'function') {
                console.error(`TableSorter: Comparator "${name}" must be a function`);
                return;
            }
            TableSorter.customComparators[name] = fn;
        }

        /**
         * Create a TableSorter instance.
         * @param {HTMLTableElement} tableElement - The table element to enhance
         */
        constructor(tableElement) {
            // Validate input
            if (!tableElement || tableElement.tagName !== 'TABLE') {
                console.error('TableSorter: Invalid table element provided');
                return;
            }

            this.table = tableElement;
            this.headers = [];
            this.dataRows = [];
            this.originalRows = []; // Store for reset functionality
            this.currentSort = {
                column: -1,
                ascending: true
            };

            // Initialize if table has valid structure
            this._init();
        }

        /**
         * Initialize the table sorter.
         * @private
         */
        _init() {
            // Locate header row and data rows
            const headerResult = this._locateHeaders();
            if (!headerResult) {
                console.warn('TableSorter: Could not locate headers, skipping table');
                return;
            }

            this.headers = headerResult.headers;

            // Store original rows for reset
            const allRows = Array.from(this.table.rows);
            const firstDataRowIndex = headerResult.dataStartIndex;
            this.originalRows = allRows.slice(firstDataRowIndex);
            this.dataRows = [...this.originalRows]; // Start with original order

            // Set up each header
            this.headers.forEach((header, index) => {
                this._setupHeader(header.element, index);
            });

            // Add .sortable class to headers (for css convenience) UNLESS
            // 'data-sortable=false' present (data-sortable=false detected in
            // _locateHeaders(), .isSortable attr added to header objects as a result)
            // This class addition can be removed if you prefer users to style via [data-sort-type] instead
            this.headers
                .filter(h => h.isSortable)
                .forEach(h => h.element.classList.add('sortable'));
        }

        /**
         * Locate header row and data rows.
         * Strategy: Find first row containing <th> elements. If none found, fall back to first row with warning.
         * @returns {Object|null} { headers: Array<{element, sortType}>, dataStartIndex: number } or null if failed
         * @private
         */
        _locateHeaders() {
            const rows = Array.from(this.table.rows);
            if (rows.length === 0) {
                console.warn('TableSorter: Table has no rows');
                return null;
            }

            // Find first row with <th> elements
            let headerRowIndex = -1;
            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].cells;
                for (let j = 0; j < cells.length; j++) {
                    if (cells[j].tagName === 'TH') {
                        headerRowIndex = i;
                        break;
                    }
                }
                if (headerRowIndex !== -1) break;
            }

            // Fallback to first row if no <th> found
            if (headerRowIndex === -1) {
                console.warn('TableSorter: No <th> elements found, using first row as header');
                headerRowIndex = 0;
            }

            const headerRow = rows[headerRowIndex];
            const headerCells = Array.from(headerRow.cells);

            // Check for colspan/rowspan (we don't support these currently)
            const hasComplexHeaders = headerCells.some(cell => cell.colSpan > 1 || cell.rowSpan > 1);
            if (hasComplexHeaders) {
                console.warn('TableSorter: Table has colspan or rowspan in headers, skipping (unsupported)');
                return null;
            }

            // Build header objects
            const headers = headerCells.map(cell => {
                // Check if column is explicitly non-sortable
                const isSortable = cell.getAttribute('data-sortable') !== 'false';
                let sortType = cell.getAttribute('data-sort-type');
                let sortTypeDesc = cell.getAttribute('data-sort-type-desc') || sortType; // Fall back to same if not specified

                if (!isSortable) {
                    sortType = null; // Mark as non-sortable
                } else if (!sortType) {
                    // Default to string with warning
                    console.warn(`TableSorter: No data-sort-type on header "${cell.textContent.trim()}", defaulting to "string"`);
                    sortType = 'string';
                }

                return {
                    element: cell,
                    sortType: sortType,
                    sortTypeDesc: sortTypeDesc,
                    isSortable: isSortable
                };
            });

            return {
                headers: headers,
                dataStartIndex: headerRowIndex + 1
            };
        }

        /**
         * Set up click handler on a header.
         * @param {HTMLElement} header - The header element
         * @param {number} index - Column index
         * @private
         */
        _setupHeader(header, index) {
            // Skip if column is not sortable
            if (!this.headers[index].isSortable) return;

            // Remove any existing listener to avoid duplicates
            header.removeEventListener('click', this._headerClickHandler);

            // Bind the handler to this instance
            const handler = this._createHeaderClickHandler(index);
            header.addEventListener('click', handler);

            // Store for potential cleanup (though not needed in basic usage)
            header._sorterHandler = handler;
        }

        /**
         * Create a click handler for a specific column.
         * @param {number} columnIndex 
         * @returns {Function} Click handler
         * @private
         */
        _createHeaderClickHandler(columnIndex) {
            return (event) => {
                event.preventDefault();

                // Determine sort direction
                let ascending = true;
                if (this.currentSort.column === columnIndex) {
                    // Toggle direction if same column
                    ascending = !this.currentSort.ascending;
                }
                // New column starts ascending (already true)

                this.sort(columnIndex, ascending);
            };
        }

        /**
         * Sort the table by a specific column.
         * @param {number} columnIndex - Column to sort by
         * @param {boolean} ascending - True for ascending, false for descending
         */
        sort(columnIndex, ascending = true) {
            // Validate column index
            if (columnIndex < 0 || columnIndex >= this.headers.length) {
                console.error(`TableSorter: Invalid column index ${columnIndex}`);
                return;
            }

            const header = this.headers[columnIndex];
            if (!header.isSortable) {
                console.warn(`TableSorter: Attempted to sort non-sortable column ${columnIndex}`);
                return;
            }

            // Get comparator for this column
            const comparator = this._getComparator(header, ascending);

            // Sort data rows
            this.dataRows.sort((rowA, rowB) => {
                const cellA = rowA.cells[columnIndex]?.textContent || '';
                const cellB = rowB.cells[columnIndex]?.textContent || '';

                const result = comparator(cellA, cellB);
                return ascending ? result : -result;
            });

            // Reattach rows to tbody (or directly to table if no tbody)
            this._renderRows();

            // Update sort state and indicators
            this.currentSort = {
                column: columnIndex,
                ascending
            };
            this._updateIndicators();
        }

        /**
         * Reset table to original unsorted order.
         */
        reset() {
            this.dataRows = [...this.originalRows];
            this._renderRows();
            this.currentSort = {
                column: -1,
                ascending: true
            };
            this._updateIndicators();
        }

        /**
         * Render the current data rows to the DOM.
         * Handles tables with or without tbody.
         * @private
         */
        _renderRows() {
            // Find or create tbody
            let tbody = this.table.querySelector('tbody');
            if (!tbody) {
                // If no tbody, wrap all rows in a new tbody
                tbody = document.createElement('tbody');
                const rows = Array.from(this.table.rows);
                rows.forEach(row => tbody.appendChild(row));
                this.table.appendChild(tbody);
            } else {
                // Clear existing rows
                tbody.innerHTML = '';
            }

            // Append sorted rows
            this.dataRows.forEach(row => tbody.appendChild(row));
        }

        /**
         * Get the appropriate comparator function for a sort type.
         * @param {Object} header - The header object
         *  (see _locateHeaders for source of truth on headers)
         * @param {boolean} ascending - true if ascending sort, false if descending
         *  (user can define different comparators for each direction)
         * @returns {Function} Comparator function
         * @private
         */
        _getComparator(header, ascending) {
            const sortType = ascending ? header.sortType : header.sortTypeDesc;

            // Handle custom comparators
            if (TableSorter.customComparators[sortType]) {
                return TableSorter.customComparators[sortType];
            }

            // Built-in comparators
            if (BUILT_IN_COMPARATORS[sortType]) {
                return BUILT_IN_COMPARATORS[sortType];
            }

            // Fallback
            console.warn(`TableSorter: Unknown sort type "${sortType}", defaulting to string`);
            return BUILT_IN_COMPARATORS.string;
        }

        /**
         * Update sort indicator classes on headers.
         * @private
         */
        _updateIndicators() {
            // Remove indicators from all headers
            this.headers.forEach(header => {
                header.element.classList.remove('sort-asc', 'sort-desc');
            });

            // Add indicator to current sort column
            if (this.currentSort.column !== -1) {
                const activeHeader = this.headers[this.currentSort.column];
                activeHeader.element.classList.add(this.currentSort.ascending ? 'sort-asc' : 'sort-desc');
            }
        }
    };

    // Auto-initialize on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        const tables = document.querySelectorAll('table[data-sortable]');
        tables.forEach(table => {
            // Avoid double-initialization
            if (!table._tableSorter) {
                table._tableSorter = new global.TableSorter(table);
            }
        });
    });

})(window);