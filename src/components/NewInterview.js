import React from "react";
import { Video, CalendarPlus, CalendarClock } from "lucide-react";
import { Modal } from "./ux/primitives";

// One place to set up an interview: start now, pick a time, or let the candidate pick.
// Each path opens the tool that does it (scheduling or booking links), where a kit can be added.
export default function NewInterview({ open, onClose, onNow, onSchedule, onBookingLink }) {
    const paths = [
        { id: "now", Icon: Video, title: "Start now", sub: "Opens the meeting now and emails the candidate a link to join.", run: onNow },
        { id: "time", Icon: CalendarPlus, title: "Pick a time", sub: "You choose the time; everyone gets a calendar invite.", run: onSchedule },
        { id: "book", Icon: CalendarClock, title: "Let them pick", sub: "Share a booking link with free times from your hours.", run: onBookingLink },
    ];
    return (
        <Modal open={open} onClose={onClose} label="Interview" title="New interview" description="Every path gives you a room with video, a shared editor and the interviewer panel. Add a session kit to set up the problem.">
            <div className="ni" role="list">
                {paths.map(({ id, Icon, title, sub, run }) => (
                    <button key={id} type="button" role="listitem" className="ni-path" onClick={() => { onClose(); run(); }}>
                        <span className="ni-ico"><Icon size={18} /></span>
                        <span className="ni-text"><b>{title}</b><span>{sub}</span></span>
                    </button>
                ))}
            </div>
        </Modal>
    );
}
