# TALV Optimizer — How to Use

The TALV Optimizer helps you find the best **TALV (Target Average Line Value)**
for a bid position, so you can build lines with the least amount of open time.

## Starting the tool

1. Double-click **`Start TALV Optimizer.bat`** in this folder.
2. A window will open and start preparing the tool. The first time you run it,
   this can take a few minutes — after that, it starts in a few seconds.
3. Once ready, the tool opens automatically in your browser.

Keep that window open while you use the tool. When you're done, simply close
the window to stop the tool.

> If the browser doesn't open on its own, open your browser and go to
> `http://localhost:5178`.

## Using the tool

1. **Choose a fleet type.** Use the *Widebody / Narrowbody* toggle near the
   top to switch which bid positions are shown.

2. **Pick your bid positions.** Under *Bid positions*, search or
   scroll the list and check every base/fleet/seat combination you want to
   run. You can select more than one at a time. Your selections are
   remembered the next time you open the tool.

3. **Set the TALV range.** *TALV lower bound* and *TALV upper bound* control
   the range of values the tool will test (72–84 by default).

4. **Choose the Line Construction Window.** Pick **± 7** or **± 10** credit
   hours.

5. **Click Run optimization.** A progress bar shows what's being calculated.

6. **Review the results.**
   - Each bid position gets a tile showing its optimal TALV, open time, and
     pilot count. Click a tile to see that position's details below.
   - The chart and table show how lineholders, reserves, and open time change
     across the TALV range — the lowest open time is highlighted.
   - Further down, the pilot credit table shows every employee's assigned
     credit at each TALV (scroll sideways to see more TALV values).

7. **Download the spreadsheet.** Click **Download Excel** at the top of the
   results to get a workbook with the same information, formatted the same
   way as before.

The contract month is detected automatically and shown at the top of the
page — you don't need to set it yourself.

## If something doesn't look right

- **The window closed or nothing opened:** Double-click
  `Start TALV Optimizer.bat` again.
- **The browser shows "can't reach this page":** Wait a few seconds and
  reload — the tool may still be starting up.
- **A bid position you expected isn't in the list:** Make sure the
  *Widebody / Narrowbody* toggle is set to match the fleet you're looking
  for. The list also only shows positions that have flying this month.
- **Numbers look different from a previous run:** Make sure the TALV range
  and Line Construction Window match what you used before — both affect the
  result.
- **Still stuck:** Contact the tool owner with a screenshot of what you're
  seeing.
