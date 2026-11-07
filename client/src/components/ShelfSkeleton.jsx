// Grey placeholder cards shown while the shelf loads, so the page doesn't jump.
export default function ShelfSkeleton() {
  return (
    <div className="shelf-grid" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="item skeleton">
          <div className="sk-line sk-title" />
          <div className="sk-line" />
          <div className="sk-line" />
          <div className="sk-line sk-short" />
        </div>
      ))}
    </div>
  );
}
