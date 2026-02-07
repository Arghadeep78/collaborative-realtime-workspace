# Product Requirements Document (PRD): Collaborative Whiteboard Platform

**Product Vision:** To provide a seamless, real-time visual collaboration workspace where teams can ideate, map, and organize information without physical boundaries.

---

## 1. Canvas Interaction & Infinite Workspace

**Overview:** The canvas is the core workspace. It must feel boundless, highly responsive, and intuitive to navigate, mimicking the freedom of a physical whiteboard while leveraging digital affordances.

### 1.1 Moving & Navigating (Panning & Zooming)
*   **Zoom Mechanics:** 
    *   **Controls:** Users can zoom via trackpad pinch, mouse scroll wheel, or on-screen UI buttons (+/- zoom percentage).
    *   **Behavior:** Zooming must be centered strictly on the user's cursor position. 
    *   **Limits:** Zoom ranges from a minimum of 5% (eagle-eye view) to 400% (close-up detail).
    *   **Quick Actions:** Provide a "Fit to Screen" toggle that automatically calculates the bounding box of all elements and zooms to fit them optimally.
*   **Panning Mechanics:**
    *   **Controls:** Spacebar + left-click drag, middle-mouse click drag, or selecting a dedicated "Hand Tool". trackpad two-finger swipe also pans natively.
    *   **Behavior:** Panning must be perfectly 1:1 with user hand movement to prevent motion sickness or disorientation.
*   **Coordinates & Persistence:**
    *   Every board inherently has an origin point (0,0). When a user re-enters a board, their viewport should persist precisely where they left off in their previous session.

### 1.2 Selection Mechanics
*   **Single Select:** Clicking an object selects it, rendering a bounding box.
*   **Multi-Select (Marquee):** Clicking and dragging on an empty canvas area creates a translucent blue bounding box. Any object thoroughly (or partially, based on user preference settings) inside the box is selected.
*   **Modifier Selection:** Holding `Shift` while clicking objects toggles their selection state (adding to or removing from the current selection group).

### 1.3 Object Manipulation (Bounding Box)
*   **Resizing:** Selected items display 8 control handles (corners and edges). 
    *   *Corner handles:* Scale the object proportionally (maintaining the aspect ratio). 
    *   *Edge handles:* Stretch the object non-uniformly (width or height independently).
*   **Rotation:** A distinct handle located just above the top center of the bounding box allows free rotation. Holding `Shift` while rotating snaps the rotation to 15-degree increments.
*   **Deletion:** Pressing the `Backspace` or `Delete` key removes the selected object(s).

---

## 2. Whiteboard Tools & Element Library

**Overview:** The toolkit empowers users to express ideas. Tools must be standardized enough to maintain board cleanliness but flexible enough for creative expression.

### 2.1 Sticky Notes
*   **Behavior:** The primary brainstorming primitive. 
*   **Text Engine:** Text automatically wraps to the next line. As text overflows the default dimensions, the font size must dynamically scale down to fit continuously. Once a minimum font threshold is reached, the sticky note expands vertically.
*   **Customization:** Pre-defined pastel color palette (Yellow, Blue, Green, Pink, Orange) for quick categorization.

### 2.2 Shapes
*   **Library:** Standard catalog including Rectangles, Ellipses/Circles, Triangles, and Diamonds.
*   **Styling:** 
    *   **Fill:** Solid colors, transparent, gradient, and an opacity slider (0-100%).
    *   **Borders:** Configurable stroke width (Thin, Medium, Thick) and stroke style (Solid, Dashed, Dotted).

### 2.3 Text Engine
*   **Standalone Text:** Users can click anywhere to start typing standalone text.
*   **Formatting Toolbar:** Appears instantly when text is selected or typed. Includes Bold, Italic, Underline, and Strikethrough.
*   **Alignment & Layout:** Left, Center, Right, and Justified text alignments. Adjustable line height and bullet/numbered lists.

### 2.4 Drawing / Pen Tool
*   **Freehand Input:** Captures high-frequency pointer movements for authentic drawing input.
*   **Smoothing algorithm:** Raw mouse strokes are naturally jagged. The system must apply local curve smoothing natively as the user draws to create aesthetically pleasing, natural-looking strokes.
*   **Sub-tools:** Pen (solid, opaque stroke), Highlighter (thick, semi-transparent stroke), Eraser (toggles between "erase whole stroke" and "pixel eraser").

### 2.5 Connectors / Lines
*   **Smart Snapping:** Endpoints of lines magnetically snap to explicitly defined anchor points (Top, Bottom, Left, Right, Center) on target shapes.
*   **Persistence:** If Shape A and Shape B are connected, moving either shape dynamically redraws and reroutes the line to maintain the connection.
*   **Line Styling:** Allow straightforward lines, smooth curved bezier lines, and orthogonal "elbow" lines (following 90-degree paths to avoid overlapping text). Arrowheads can be toggled on either termini.

---

## 3. Real-Time Collaboration & Presence

**Overview:** The magic of the tool is feeling like you are in the same room as your coworkers. Collaboration must feel instantaneous and conflict-free.

### 3.1 Live Cursors
*   **Rendering:** Co-workers' cursors are rendered moving in real-time. Each cursor is assigned a unique contrasting color.
*   **Identification:** The user’s first name (or full name) hovers directly below their pointer.
*   **Off-screen Indicators:** If a user is active but out of the current user's viewport, a small colored bubble with their initial appears at the absolute edge of the screen pointing in their direction.
*   **Idle State:** Cursors fade to 30% opacity when a user hasn't moved their mouse for 5 seconds, and disappear completely after 30 seconds or when the user switches browser tabs.

### 3.2 State Synchronization & Conflict Resolution
*   **Broadcasting:** Every element addition, movement, resizing, or deletion updates immediately for all viewers (target latency: < 50ms).
*   **Edit Locking (Micro-locking):** If User A is actively typing in a specific sticky note, User B sees a glowing border (matching User A's cursor color) indicating it is in use. User B is temporarily restricted from typing in that specific note until User A defocuses.
*   **Undo/Redo:** The Undo/Redo stack is strictly local to the individual user. Pressing Undo reverses the *user's* last action, not the last action taken on the broader board by a collaborator.

### 3.3 User Presence Bar
*   **Active Roster:** Top-right UI element displaying the avatars (or initials) of everyone currently viewing the board.
*   **"Follow Me" (Spotlight):** A presentation feature. Clicking "Follow Me" forces all active users' viewports to smoothly pan and zoom to match the presenter's exact viewport.
*   **"Follow User":** A passive observation feature. A user can click a colleague’s avatar to attach their camera to that colleague. If the colleague pans or zooms, the observer's screen mirrors it until the observer manually scrolls or clicks away.

---

## 4. Arrangement, Layering & Organizing

**Overview:** As boards grow to hundreds of items, spatial organization becomes critical for maintaining a usable workspace.

### 4.1 Layer Management (Z-Index)
*   **Hierarchy:** Elements created more recently sit on top of older elements by default.
*   **Controls:** Via right-click context menu and keyboard shortcuts:
    *   *Bring to Front*: Move absolute top.
    *   *Send to Back*: Move to absolute bottom.
    *   *Bring Forward / Send Backward*: Move up or down one logical layer at a time.

### 4.2 Alignment & Distribution
*   **Alignment:** When multiple items are selected, users can align them by their top edges, bottom edges, left/right edges, or vertical/horizontal centers. The system calculates the outer physical bounds of the entire selection to determine the alignment axis.
*   **Distribution:** Users can select 3+ items and apply "Distribute Horizontally" or "Distribute Vertically", which calculates the available space between the outermost elements and spaces the interior elements with identical mathematical gaps.

### 4.3 Grouping
*   ** Mechanics:** Pressing `Cmd/Ctrl + G` creates a unified group from several elements. They now calculate a unified bounding box and move, scale, and delete as one atomic object.
*   **Nested Access:** Double-clicking any element inside a group allows localized editing of that specific element without breaking the overarching group.

### 4.4 Locking
*   **Purpose:** To protect foundational framework elements (like a drawn Kanban board or background template) from accidental displacement.
*   **Mechanics:** Selected elements can be "Locked". Locked items lose their editable bounding boxes and ignore hover states. A small padlock icon appears in the corner.
*   **Constraints:** Only users with Editor permissions or higher can unlock an item. 

---

## 5. Board Management & Access Control

**Overview:** The ecosystem outside the canvas. Boards must be easily manageable, discoverable, and securely shareable.

### 5.1 Dashboard & Workspace
*   **Overview:** Provides a gallery of recent boards and a directory of favorite/starred boards. Includes toggles between Grid (thumbnails) and List views.
*   **Actions:** Users can create blank boards, create from a template library, rename boards, duplicate boards (creating a distinct clone detached from the original), and move boards to a trash bin (with a 30-day recovery window).
*   **Search:** Global search that checks board titles and potentially textual content inside the boards.

### 5.2 Sharing Permissions & Roles
*   **Role Definitions:**
    *   *Viewer:* Can only navigate the board and utilize "Follow" functionality. Cannot modify elements or leave comments.
    *   *Commenter:* Can view and pin textual comments to specific coordinate locations on the board, but cannot alter core canvas elements.
    *   *Editor:* Full read/write access to all tools, elements, and standard board controls.
*   **Link Sharing:** Toggle to enable "Anyone with the link can [View/Comment/Edit]". If toggled off, the board strictly defaults to private.
*   **Explicit Invites:** Ability to type email addresses to send secure invite links. Invited users appear in an "Access List" where the owner can downgrade their role or revoke access entirely at any time.

### 5.3 Exporting Options
*   **Formats:** Users can export the board as a high-resolution PNG, JPEG, or vector-capable PDF.
*   **Scope:**
    *   *Entire Canvas:* Automatically crops the export boundary strictly to the outermost elements on the board (ignoring infinite empty space).
    *   *Selection Only:* Exports only the currently highlighted items and their immediate intersecting area with a transparent background.

---

## 6. Advanced Collaboration & Facilitator Tools

**Overview:** Features designed for running workshops, meetings, and guided sessions.

*   **Frames (Presentation Mode):** Ability to draw "Frames" (artboards) around specific sections of the canvas. Frames act as slides. Users can navigate chronologically through frames, exporting them collectively as a multi-page PDF.
*   **Timer:** A globally visible countdown timer that the host can set for time-boxed activities (e.g., "5 minutes for brainstorming").
*   **Voting System:** Mechanism to allocate a set number of votes per user. Users can click on elements (like sticky notes) to upvote them anonymously, with results revealed at the end of the session.

---

## 7. Media & External Integrations

**Overview:** Handling external assets to enrich the whiteboard experience.

*   **Image Uploads & Files:** Drag-and-drop support for pasting PNG, JPEG, SVG, and GIF files directly onto the canvas. 
*   **Clipboard Support:** Pasting images or text directly from the operating system's clipboard (`Cmd/Ctrl + V`).
*   **Link Unfurling:** Pasting a web URL natively renders a visual card summarizing the webpage's metadata (Title, Thumbnail, Description) rather than just a raw text link.

---

## 8. Asynchronous Communication & History

**Overview:** Supporting workflows that occur over days or weeks, outside of live synchronous sessions.

*   **Comments & @Mentions:** Users can drop a "Comment Pin" anywhere on the board or attach it to a specific shape. Threads support nested replies. Typing `@` followed by a collaborator's name triggers an email/in-app notification.
*   **Version History / Activity Log:** A timeline view showing major snapshots of the board over time. Allows a user to view who changed what, and gives Editors the ability to restore the board to a previous stable state in case of accidental mass-deletions.
*   **Notifications:** An inbox panel on the dashboard summarizing mentions, board invites, and replies to comments.