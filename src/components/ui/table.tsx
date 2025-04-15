import * as React from "react"

import { cn } from "@/lib/utils"

// Extended interface to add role and aria attributes for accessibility
interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /**
   * For layout tables only. Set to "presentation" or "none" to indicate this table is not for data.
   * Note: Using tables for layout is generally not recommended.
   */
  role?: "presentation" | "none" | string;
  
  /**
   * Optional array of header labels that will automatically generate a header row
   * Use this to ensure tables always have headers for accessibility
   */
  headers?: string[];
  
  /**
   * Optional label for the table that can be referenced by aria-labelledby
   */
  ariaLabel?: string;
  
  /**
   * Whether this table is used for layout purposes only and not for data presentation
   * Setting this to true will automatically set role="presentation" and suppress accessibility warnings
   */
  isLayoutTable?: boolean;
}

/**
 * Table Component
 * 
 * ACCESSIBILITY NOTE:
 * For data tables, always include a TableHeader with TableHead elements to provide
 * proper headers for screen readers and other assistive technologies.
 * 
 * Tables MUST have headers to be accessible. You can provide headers in two ways:
 * 1. Using the headers prop directly on the Table component
 * 2. Including a TableHeader with TableHead elements as children
 * 
 * Example 1 (using headers prop):
 * <Table headers={["Name", "Age"]}>
 *   <TableBody>
 *     <TableRow>
 *       <TableCell>John Doe</TableCell>
 *       <TableCell>24</TableCell>
 *     </TableRow>
 *   </TableBody>
 * </Table>
 * 
 * Example 2 (using TableHeader component):
 * <Table>
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead>Name</TableHead>
 *       <TableHead>Age</TableHead>
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>...</TableBody>
 * </Table>
 * 
 * If this table is used for layout purposes only (not recommended), set the isLayoutTable prop to true.
 */
const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, role, headers, ariaLabel, isLayoutTable = false, children, ...props }, ref) => {
    const tableRole = role || (isLayoutTable ? "presentation" : undefined);
    
    // Generate header row if headers prop is provided
    const headerRow = headers && headers.length > 0 ? (
      <TableHeader>
        <TableRow>
          {headers.map((header, index) => (
            <TableHead key={index}>{header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
    ) : null;
    
    // Check if there's already a TableHeader among children
    let hasHeaderInChildren = false;
    React.Children.forEach(children, child => {
      if (React.isValidElement(child) && child.type === TableHeader) {
        hasHeaderInChildren = true;
      }
    });
    
    // For development warnings (won't be included in production)
    if (process.env.NODE_ENV !== 'production' && 
        !isLayoutTable && 
        !tableRole && 
        !headerRow && 
        !hasHeaderInChildren) {
      console.warn(
        'Accessibility Warning: Tables should have headers using either the headers prop or TableHeader component. ' +
        'If this is a layout table, set isLayoutTable to true.'
      );
    }

    return (
      <div className="relative w-full overflow-auto">
        <table
          ref={ref}
          className={cn("w-full caption-bottom text-sm", className)}
          role={tableRole}
          aria-label={ariaLabel}
          {...props}
        >
          {headerRow}
          {children}
        </table>
      </div>
    )
  }
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead 
    ref={ref} 
    className={cn("[&_tr]:border-b", className)} 
    {...props} 
  />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

// Extended interface for TableHead to support scope attribute
interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /**
   * Defines the cells that the header element relates to.
   * Default is "col" which is appropriate for column headers.
   * Use "row" for row headers.
   */
  scope?: "col" | "row" | "colgroup" | "rowgroup";
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, scope = "col", ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      scope={scope}
      {...props}
    />
  )
)
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
