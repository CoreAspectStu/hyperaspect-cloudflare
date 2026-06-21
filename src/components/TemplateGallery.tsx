"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { TEMPLATES, CATEGORIES, type Template, type TemplateCategory } from "@/lib/templates";
import { Search, Clock, X, Check, ArrowRight } from "lucide-react";

interface TemplateGalleryProps {
  onSelectTemplate: (template: Template) => void;
}

export default function TemplateGallery({ onSelectTemplate }: TemplateGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Body scroll lock when detail modal is open
  useEffect(() => {
    if (selectedTemplate) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [selectedTemplate]);

  const filtered = useMemo(() => {
    let result = TEMPLATES;
    if (activeCategory !== "All") {
      result = result.filter(t => t.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    return result.sort((a, b) => a.popularity_rank - b.popularity_rank);
  }, [activeCategory, searchQuery]);

  return (
    <div style={{ width: "100%" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h2 style={{
          fontSize: "2.5rem", fontWeight: 900, color: "#0a0a0a",
          textTransform: "uppercase", letterSpacing: "-0.02em",
          marginBottom: "8px",
        }}>
          Choose a Template
        </h2>
        <p style={{ fontSize: "1.1rem", color: "#0a0a0a", opacity: 0.7 }}>
          {TEMPLATES.length} proven video structures — pick one and AI fills in the details
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "center" }}>
        <div style={{
          position: "relative", width: "100%", maxWidth: "500px",
        }}>
          <Search size={20} style={{
            position: "absolute", left: "16px", top: "50%",
            transform: "translateY(-50%)", color: "#0a0a0a", opacity: 0.5,
          }} />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: "100%", padding: "14px 16px 14px 48px",
              fontSize: "1rem", fontWeight: 600,
              border: "4px solid #0a0a0a",
              backgroundColor: "#fff",
              boxShadow: "4px 4px 0 #0a0a0a",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Category Chips */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "8px",
        justifyContent: "center", marginBottom: "32px",
      }}>
        <CategoryChip
          label="All"
          emoji="✨"
          active={activeCategory === "All"}
          onClick={() => setActiveCategory("All")}
        />
        {CATEGORIES.map(cat => (
          <CategoryChip
            key={cat.name}
            label={cat.name}
            emoji={cat.emoji}
            active={activeCategory === cat.name}
            onClick={() => setActiveCategory(cat.name)}
          />
        ))}
      </div>

      {/* Results count */}
      <div style={{ marginBottom: "16px", textAlign: "center" }}>
        <span style={{ fontWeight: 700, color: "#0a0a0a", opacity: 0.6, fontSize: "0.9rem" }}>
          {filtered.length} template{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Template Grid */}
      {filtered.length > 0 ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "20px",
        }}>
          {filtered.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onClick={() => setSelectedTemplate(template)}
            />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0a0a0a", opacity: 0.5 }}>
            No templates found. Try a different search.
          </p>
        </div>
      )}

      {/* Detail Modal — rendered via Portal to escape transformed ancestors */}
      {selectedTemplate && typeof document !== "undefined" && createPortal(
        <TemplateDetailModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onUse={() => {
            onSelectTemplate(selectedTemplate);
            setSelectedTemplate(null);
          }}
        />,
        document.body
      )}
    </div>
  );
}

function CategoryChip({ label, emoji, active, onClick }: {
  label: string; emoji: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        fontSize: "0.9rem", fontWeight: 800,
        border: "3px solid #0a0a0a",
        backgroundColor: active ? "#0a0a0a" : "#fef6e4",
        color: active ? "#fef6e4" : "#0a0a0a",
        boxShadow: active ? "3px 3px 0 #ff0000" : "3px 3px 0 #0a0a0a",
        cursor: "pointer",
        transition: "all 0.1s",
        display: "flex", alignItems: "center", gap: "6px",
        textTransform: "uppercase", letterSpacing: "0.02em",
      }}
    >
      <span style={{ fontSize: "1.1rem" }}>{emoji}</span>
      {label}
    </button>
  );
}

function TemplateCard({ template, onClick }: {
  template: Template; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        border: "4px solid #0a0a0a",
        backgroundColor: "#fff",
        boxShadow: "6px 6px 0 #0a0a0a",
        cursor: "pointer",
        transition: "transform 0.15s, box-shadow 0.15s",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translate(-2px, -2px)";
        e.currentTarget.style.boxShadow = "8px 8px 0 #0a0a0a";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translate(0, 0)";
        e.currentTarget.style.boxShadow = "6px 6px 0 #0a0a0a";
      }}
    >
      {/* Thumbnail Area */}
      <div style={{
        height: "140px",
        backgroundColor: template.accent_color,
        backgroundImage: `url(/templates/${template.id}.jpg)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        borderBottom: "4px solid #0a0a0a",
      }}>
        <span style={{ fontSize: "3.5rem", filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))" }}>{template.emoji}</span>
        {/* Duration badge */}
        <div style={{
          position: "absolute", bottom: "8px", right: "8px",
          padding: "2px 8px",
          backgroundColor: "#0a0a0a", color: "#fef6e4",
          fontSize: "0.75rem", fontWeight: 800,
          display: "flex", alignItems: "center", gap: "4px",
        }}>
          <Clock size={12} />
          {template.default_duration_sec}s
        </div>
        {/* Aspect ratio badge */}
        <div style={{
          position: "absolute", top: "8px", left: "8px",
          padding: "2px 8px",
          backgroundColor: "#fef6e4", color: "#0a0a0a",
          fontSize: "0.7rem", fontWeight: 800,
          border: "2px solid #0a0a0a",
        }}>
          {template.aspect_ratios.recommended.join(", ")}
        </div>
        {/* Difficulty badge */}
        <div style={{
          position: "absolute", top: "8px", right: "8px",
          padding: "2px 8px",
          backgroundColor: template.difficulty === "beginner" ? "#b8ff00" :
                          template.difficulty === "intermediate" ? "#ffd60a" : "#ff6b6b",
          color: "#0a0a0a",
          fontSize: "0.7rem", fontWeight: 800,
          border: "2px solid #0a0a0a",
          textTransform: "capitalize",
        }}>
          {template.difficulty}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "16px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
          <span style={{
            padding: "2px 8px",
            backgroundColor: "#fef6e4",
            border: "2px solid #0a0a0a",
            fontSize: "0.7rem", fontWeight: 800,
            color: "#0a0a0a",
          }}>
            {template.category}
          </span>
        </div>
        <h3 style={{
          fontSize: "1.2rem", fontWeight: 900, color: "#0a0a0a",
          marginBottom: "6px", lineHeight: 1.2,
        }}>
          {template.name}
        </h3>
        <p style={{
          fontSize: "0.85rem", color: "#0a0a0a", opacity: 0.7,
          lineHeight: 1.4, flex: 1,
        }}>
          {template.description}
        </p>
        {/* Tags */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "4px",
          marginTop: "10px",
        }}>
          {template.tags.slice(0, 3).map(tag => (
            <span key={tag} style={{
              padding: "1px 6px",
              fontSize: "0.7rem", fontWeight: 600,
              backgroundColor: "#fef6e4",
              color: "#0a0a0a", opacity: 0.6,
            }}>
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplateDetailModal({ template, onClose, onUse }: {
  template: Template;
  onClose: () => void;
  onUse: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        zIndex: 9999,
        overflowY: "auto",
      }}
    >
      <div style={{
        minHeight: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: "#fef6e4",
          border: "4px solid #0a0a0a",
          boxShadow: "10px 10px 0 #0a0a0a",
          maxWidth: "600px", width: "100%",
          maxHeight: "90vh", overflow: "auto",
          margin: "auto",
        }}
      >
        {/* Header */}
        <div style={{
          height: "200px",
          backgroundColor: template.accent_color,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
          borderBottom: "4px solid #0a0a0a",
        }}>
          <span style={{ fontSize: "5rem" }}>{template.emoji}</span>
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: "12px", right: "12px",
              width: "36px", height: "36px",
              border: "3px solid #0a0a0a",
              backgroundColor: "#fef6e4",
              boxShadow: "3px 3px 0 #0a0a0a",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={20} color="#0a0a0a" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px" }}>
          {/* Badges */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            <Badge>{template.category}</Badge>
            <Badge><Clock size={12} /> {template.default_duration_sec}s</Badge>
            <Badge>{template.aspect_ratios.recommended.join(", ")}</Badge>
            <Badge>{template.difficulty}</Badge>
            <Badge>{template.scenes.length} scenes</Badge>
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: "1.8rem", fontWeight: 900, color: "#0a0a0a",
            marginBottom: "8px",
          }}>
            {template.name}
          </h2>

          {/* Description */}
          <p style={{
            fontSize: "1rem", color: "#0a0a0a", opacity: 0.8,
            marginBottom: "20px", lineHeight: 1.5,
          }}>
            {template.description}
          </p>

          {/* What you'll need */}
          <div style={{
            border: "3px solid #0a0a0a",
            backgroundColor: "#fff",
            padding: "16px",
            marginBottom: "20px",
          }}>
            <h3 style={{
              fontSize: "0.9rem", fontWeight: 900, color: "#0a0a0a",
              marginBottom: "10px", textTransform: "uppercase",
            }}>
              What you'll need:
            </h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {template.what_you_need.map((item, i) => (
                <li key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: "8px",
                  marginBottom: "6px", fontSize: "0.9rem", color: "#0a0a0a",
                }}>
                  <Check size={16} color="#0a0a0a" style={{ marginTop: "2px", flexShrink: 0 }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Scene breakdown */}
          <div style={{
            border: "3px solid #0a0a0a",
            backgroundColor: "#fff",
            padding: "16px",
            marginBottom: "20px",
          }}>
            <h3 style={{
              fontSize: "0.9rem", fontWeight: 900, color: "#0a0a0a",
              marginBottom: "10px", textTransform: "uppercase",
            }}>
              Scene Breakdown ({template.scenes.length} scenes):
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {template.scenes.map((scene, i) => (
                <div key={scene.id} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  fontSize: "0.85rem",
                }}>
                  <span style={{
                    fontWeight: 900, color: "#0a0a0a",
                    minWidth: "24px",
                  }}>
                    {i + 1}.
                  </span>
                  <span style={{
                    flex: 1, fontWeight: 600, color: "#0a0a0a",
                    textTransform: "capitalize",
                  }}>
                    {scene.type.replace(/_/g, " ")}
                  </span>
                  <span style={{
                    padding: "1px 8px",
                    backgroundColor: "#fef6e4",
                    border: "2px solid #0a0a0a",
                    fontSize: "0.75rem", fontWeight: 800,
                  }}>
                    {scene.duration_sec}s
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: "14px",
                border: "4px solid #0a0a0a",
                backgroundColor: "#fff",
                boxShadow: "5px 5px 0 #0a0a0a",
                fontSize: "0.95rem", fontWeight: 800,
                color: "#0a0a0a", cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              Back
            </button>
            <button
              onClick={onUse}
              style={{
                flex: 2, padding: "14px",
                border: "4px solid #0a0a0a",
                backgroundColor: "#ff0000",
                boxShadow: "5px 5px 0 #0a0a0a",
                fontSize: "0.95rem", fontWeight: 900,
                color: "#fff", cursor: "pointer",
                textTransform: "uppercase",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              Use This Template
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      padding: "3px 10px",
      border: "2px solid #0a0a0a",
      backgroundColor: "#fff",
      fontSize: "0.75rem", fontWeight: 800,
      color: "#0a0a0a",
      display: "flex", alignItems: "center", gap: "4px",
    }}>
      {children}
    </span>
  );
}
