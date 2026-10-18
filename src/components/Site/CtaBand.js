import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { newRoomId } from "../ux/primitives";

// Closing call to action: giant condensed line with a circular go button.
export default function CtaBand({
    title = ["Start a", "room."],
    text = "No install. Send a link and everyone can join, even before they register.",
    cta = "Create a room",
}) {
    const navigate = useNavigate();
    const go = () => navigate(`/editor/${newRoomId()}`);
    return (
        <section className="u-section l-cta" data-rise>
            <button className="l-cta-title u-hover" onClick={go} aria-label={cta}>
                <span className="u-display u-giant">{title[0]}</span>
                <span className="u-display u-giant">{title[1]} <span className="u-circ l-cta-go"><ArrowUpRight size={34} /></span></span>
            </button>
            <div className="l-cta-foot">
                <p className="u-lede" style={{ maxWidth: 520 }}>{text}</p>
                <button className="u-btn u-btn--solid u-btn--lg" onClick={go}>{cta} <ArrowUpRight size={16} /></button>
            </div>
        </section>
    );
}
