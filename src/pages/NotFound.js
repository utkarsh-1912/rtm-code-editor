import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import SiteLayout from "../components/Site/SiteLayout";
import { RollingNumber } from "../components/ux/primitives";

const NotFound = () => {
    const { pathname } = useLocation();
    return (
        <SiteLayout>
            <section className="nf">
                <span className="u-label" data-rise>Error · {pathname}</span>
                <h1 className="nf-num" style={{ margin: 0 }}><RollingNumber value={404} /></h1>
                <p className="u-lede" data-rise style={{ "--d": "200ms" }}>
                    <b>Room not found.</b> The page does not exist or has moved. The room may also have ended.
                </p>
                <div className="u-head-actions" data-rise style={{ "--d": "260ms" }}>
                    <Link to="/" className="u-btn u-btn--solid u-btn--lg">Back home <ArrowUpRight size={15} /></Link>
                    <Link to="/support" className="u-btn u-btn--ghost u-btn--lg">Contact support</Link>
                </div>
            </section>
        </SiteLayout>
    );
};

export default NotFound;
