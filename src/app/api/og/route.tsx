import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawTitle = searchParams.get("title")?.trim();
  const rawAuthor = searchParams.get("author")?.trim();

  const title = rawTitle && rawTitle.length > 0 ? rawTitle : "Wallabax Reader";
  const author = rawAuthor && rawAuthor.length > 0 ? rawAuthor : null;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #ecfeff 0%, #f0fdfa 55%, #f8fafc 100%)",
          color: "#0f172a",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
          padding: "64px 72px",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            fontSize: 30,
            fontWeight: 700,
            color: "#0f766e",
          }}
        >
          <span>Wallabax</span>
          <span style={{ color: "#14b8a6", fontWeight: 500 }}>Reader</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: "100%",
          }}
        >
          <div
            style={{
              fontSize: 60,
              lineHeight: 1.08,
              fontWeight: 800,
              letterSpacing: -1.2,
              display: "-webkit-box",
              overflow: "hidden",
              textOverflow: "ellipsis",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 4,
            }}
          >
            {title}
          </div>

          {author ? (
            <div
              style={{
                fontSize: 30,
                lineHeight: 1.2,
                fontWeight: 600,
                color: "#334155",
              }}
            >
              {author}
            </div>
          ) : null}
        </div>

        <div
          style={{
            fontSize: 26,
            color: "#475569",
            fontWeight: 500,
          }}
        >
          Clean reader page
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
