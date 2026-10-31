export function PortalIllustration({ kind }: { kind: 'salon' | 'customer' }) {
  return <div className={`portal-art portal-art-${kind}`} aria-hidden="true">
    {kind === 'salon' ? <SalonScene/> : <CustomerScene/>}
  </div>;
}

function SalonScene() {
  return <svg viewBox="0 0 300 280" fill="none" className="portal-scene">
    <defs>
      <linearGradient id="salon-mirror-rim" x1="80" y1="20" x2="230" y2="230" gradientUnits="userSpaceOnUse"><stop stopColor="#e7c7a2"/><stop offset=".4" stopColor="#af8267"/><stop offset=".65" stopColor="#efd7ba"/><stop offset="1" stopColor="#987357"/></linearGradient>
      <linearGradient id="salon-glass" x1="100" y1="40" x2="210" y2="200" gradientUnits="userSpaceOnUse"><stop stopColor="#fffdf8"/><stop offset=".5" stopColor="#d7e3df"/><stop offset="1" stopColor="#aebfbd"/></linearGradient>
      <linearGradient id="salon-chair" x1="95" y1="130" x2="213" y2="230" gradientUnits="userSpaceOnUse"><stop stopColor="#b787a2"/><stop offset=".4" stopColor="#8a5875"/><stop offset="1" stopColor="#502b48"/></linearGradient>
      <linearGradient id="salon-seat" x1="125" y1="187" x2="180" y2="225" gradientUnits="userSpaceOnUse"><stop stopColor="#bd94ac"/><stop offset="1" stopColor="#70425e"/></linearGradient>
      <linearGradient id="salon-metal" x1="110" y1="215" x2="185" y2="260" gradientUnits="userSpaceOnUse"><stop stopColor="#f8e5ce"/><stop offset=".45" stopColor="#b18b70"/><stop offset="1" stopColor="#e8c5a3"/></linearGradient>
    </defs>
    <ellipse className="scene-shadow" cx="150" cy="256" rx="94" ry="13" fill="#8d6073" opacity=".15"/>
    <g className="scene-float">
      <path d="M84 178V81a66 66 0 0 1 132 0v97Z" fill="#bb947b"/>
      <path d="M78 174V78a66 66 0 0 1 132 0v96Z" fill="url(#salon-mirror-rim)"/>
      <path d="M90 162V79a54 54 0 0 1 108 0v83Z" fill="url(#salon-glass)"/>
      <path d="m105 110 56-66m-49 103 70-83" stroke="white" strokeWidth="9" strokeLinecap="round" opacity=".45"/>
      <rect x="67" y="167" width="158" height="12" rx="6" fill="#b18d75"/>
      <rect x="67" y="164" width="158" height="9" rx="4.5" fill="#e2c5aa"/>
      <ellipse cx="148" cy="246" rx="40" ry="8" fill="#aa826c"/>
      <ellipse cx="146" cy="243" rx="40" ry="8" fill="url(#salon-metal)"/>
      <rect x="140" y="212" width="13" height="30" rx="5" fill="url(#salon-metal)"/>
      <path d="M105 160c0-19 15-27 42-27s43 8 43 27v45h-85Z" fill="#623a53"/>
      <path d="M98 157c0-19 16-28 43-28s43 9 43 28v41H98Z" fill="url(#salon-chair)"/>
      <path d="M109 147c9-10 42-12 62 0" stroke="#d5b1c6" strokeWidth="3" strokeLinecap="round" opacity=".65"/>
      <rect x="97" y="189" width="92" height="27" rx="12" fill="#5d344f"/>
      <rect x="94" y="185" width="92" height="25" rx="12" fill="url(#salon-seat)"/>
      <path d="M90 173v25m103-25v25" stroke="url(#salon-metal)" strokeWidth="7" strokeLinecap="round"/>
      <rect x="80" y="166" width="27" height="10" rx="5" fill="#81546d"/>
      <rect x="178" y="166" width="27" height="10" rx="5" fill="#81546d"/>
      <g className="scene-tool"><path d="m231 105 16-43m-9 49-20-43" stroke="#bd9279" strokeWidth="5" strokeLinecap="round"/><circle cx="227" cy="118" r="9" stroke="#8a5875" strokeWidth="5"/><circle cx="245" cy="120" r="9" stroke="#8a5875" strokeWidth="5"/><circle cx="234" cy="99" r="3" fill="#f5e2c9"/></g>
      <rect x="48" y="133" width="18" height="30" rx="5" fill="#8c9f90"/><rect x="52" y="126" width="10" height="10" rx="2" fill="#d3b396"/><path d="M57 126v-5h10" stroke="#b38c71" strokeWidth="3" strokeLinecap="round"/>
    </g>
    <g className="scene-sparkle" stroke="#a67b92" strokeWidth="2.5" strokeLinecap="round"><path d="M47 72v18m-9-9h18M242 187v14m-7-7h14"/></g>
  </svg>;
}

function CustomerScene() {
  return <svg viewBox="0 0 300 280" fill="none" className="portal-scene">
    <defs>
      <linearGradient id="cust-man-hair" x1="60" y1="50" x2="140" y2="130" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3d2c29"/>
        <stop offset=".5" stopColor="#2a1d1b"/>
        <stop offset="1" stopColor="#18100f"/>
      </linearGradient>
      <linearGradient id="cust-woman-hair" x1="160" y1="40" x2="250" y2="200" gradientUnits="userSpaceOnUse">
        <stop stopColor="#966348"/>
        <stop offset=".45" stopColor="#674132"/>
        <stop offset="1" stopColor="#3a251e"/>
      </linearGradient>
      <linearGradient id="cust-man-skin" x1="80" y1="80" x2="135" y2="155" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fbe2cb"/>
        <stop offset=".6" stopColor="#e3b493"/>
        <stop offset="1" stopColor="#cf9677"/>
      </linearGradient>
      <linearGradient id="cust-woman-skin" x1="165" y1="85" x2="225" y2="160" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffe4cd"/>
        <stop offset=".55" stopColor="#edb896"/>
        <stop offset="1" stopColor="#da9c7f"/>
      </linearGradient>
      <linearGradient id="cust-man-top" x1="50" y1="180" x2="145" y2="255" gradientUnits="userSpaceOnUse">
        <stop stopColor="#76506a"/>
        <stop offset=".45" stopColor="#57334d"/>
        <stop offset="1" stopColor="#3a1f33"/>
      </linearGradient>
      <linearGradient id="cust-woman-top" x1="150" y1="180" x2="250" y2="255" gradientUnits="userSpaceOnUse">
        <stop stopColor="#b9d0bf"/>
        <stop offset=".4" stopColor="#87aa94"/>
        <stop offset="1" stopColor="#5c826e"/>
      </linearGradient>
      <linearGradient id="cust-card-bg" x1="110" y1="160" x2="190" y2="235" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffffff"/>
        <stop offset="1" stopColor="#f6ede5"/>
      </linearGradient>
      <linearGradient id="cust-card-check" x1="135" y1="190" x2="165" y2="225" gradientUnits="userSpaceOnUse">
        <stop stopColor="#76b18d"/>
        <stop offset="1" stopColor="#4f8564"/>
      </linearGradient>
    </defs>
    <ellipse className="scene-shadow" cx="150" cy="256" rx="98" ry="13" fill="#8d6073" opacity=".14"/>
    <g className="scene-float">
      <circle cx="150" cy="130" r="104" fill="#ede3da" opacity=".55"/>
      <circle cx="150" cy="130" r="82" fill="#e5d5c9" opacity=".35"/>

      {/* ─── MAN (Left side) ─── */}
      <path d="M70 110c-3-28 10-58 36-58 24 0 34 18 34 44l-4 22h-10l-2-16c-4 3-10 4-18 4-14 0-22-6-28-16l-4 22H70Z" fill="url(#cust-man-hair)"/>
      <path d="M40 248c5-38 24-56 56-56 22 0 38 9 49 25l-7 31H40Z" fill="url(#cust-man-top)"/>
      <path d="M84 192c7 9 19 9 26 0" stroke="#cfaec3" strokeWidth="3" strokeLinecap="round"/>
      <path d="M88 148v22c0 9 18 9 18 0v-22" fill="url(#cust-man-skin)"/>
      <ellipse cx="71" cy="112" rx="6" ry="10" fill="#dfae8e"/>
      <path d="M74 96c0-23 12-38 31-38 20 0 31 15 31 38v18c0 23-12 36-31 36s-31-13-31-36Z" fill="url(#cust-man-skin)"/>
      <path d="M72 94c0-22 12-42 34-42 22 0 32 14 31 30-10-6-20-7-30-4-9 3-17 10-23 18l-12-2Z" fill="url(#cust-man-hair)"/>
      <path d="M80 66c8-10 24-12 38-5" stroke="#4d3935" strokeWidth="3.5" strokeLinecap="round" opacity=".7"/>
      <path d="M73 106v-12c3-4 6-6 10-7" stroke="#2a1d1b" strokeWidth="2.5" strokeLinecap="round" opacity=".5"/>
      <path d="M81 90c5-3 12-3 17 0" stroke="#312220" strokeWidth="2.8" strokeLinecap="round"/>
      <path d="M107 90c5-3 12-3 17 0" stroke="#312220" strokeWidth="2.8" strokeLinecap="round"/>
      <path d="M84 103c3 4 8 4 11 0" stroke="#48322e" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M110 103c3 4 8 4 11 0" stroke="#48322e" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M100 103v9h4" stroke="#c08970" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M93 125c4 4 12 4 16 0" stroke="#9c5454" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M78 120c8 16 32 16 42 0" stroke="#af8571" strokeWidth="1.8" strokeDasharray="1 3" opacity=".5"/>

      {/* ─── WOMAN (Right side) ─── */}
      <path d="M152 118c-7-44 14-80 50-80 44 0 58 32 54 74l-6 82h-32c-3-20-4-36-8-48l-8 24-22-2-4-26c-12 12-20-8-24-24Z" fill="url(#cust-woman-hair)"/>
      <path d="M144 248c4-36 22-54 54-54 32 0 54 18 60 54H144Z" fill="url(#cust-woman-top)"/>
      <path d="M188 148v22c0 10 20 10 20 0v-22" fill="url(#cust-woman-skin)"/>
      <path d="M182 178c7 9 22 9 29 0" stroke="#e8c699" strokeWidth="2" strokeLinecap="round"/>
      <ellipse cx="228" cy="116" rx="6" ry="10" fill="#daa183"/>
      <path d="M168 102c0-22 13-36 28-36s28 14 28 36v18c0 24-12 36-28 36s-28-12-28-36Z" fill="url(#cust-woman-skin)"/>
      <path d="M162 100c24-10 46-4 56 18 3-18 16-24 28-20 4-22-10-44-38-44-24 0-40 18-46 46Z" fill="url(#cust-woman-hair)"/>
      <path d="M172 74c10-14 30-20 44-16" stroke="#bd9271" strokeWidth="4.5" strokeLinecap="round" opacity=".5"/>
      <path d="M178 96c4-2 10-2 14 1" stroke="#5d3c34" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M204 97c4-3 10-3 14 1" stroke="#5d3c34" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M180 108c3 4 8 4 11 0" stroke="#543731" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M205 108c3 4 8 4 11 0" stroke="#543731" strokeWidth="2.5" strokeLinecap="round"/>
      <ellipse cx="178" cy="120" rx="7" ry="4" fill="#e99d94" opacity=".4"/>
      <ellipse cx="216" cy="120" rx="7" ry="4" fill="#e99d94" opacity=".4"/>
      <path d="M197 109v8h3" stroke="#d5997d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M189 127c4 5 12 5 16 0" stroke="#b25a5a" strokeWidth="2.6" strokeLinecap="round"/>
      <circle cx="229" cy="120" r="4" stroke="#e8c699" strokeWidth="2.5"/>

      {/* ─── FOREGROUND: Floating Booking Badge ─── */}
      <g className="scene-booking">
        <rect x="119" y="174" width="62" height="64" rx="14" fill="#84506f" opacity=".18"/>
        <rect x="116" y="170" width="62" height="64" rx="14" fill="url(#cust-card-bg)" stroke="#ecdcd2" strokeWidth="1.5"/>
        <path d="M116 186h62" stroke="#dec5cf" strokeWidth="1.5"/>
        <rect x="127" y="165" width="4" height="10" rx="2" fill="#976480"/>
        <rect x="157" y="165" width="4" height="10" rx="2" fill="#976480"/>
        <circle cx="147" cy="207" r="13" fill="url(#cust-card-check)"/>
        <path d="m142 207 4 4 7-8" stroke="#fffdf5" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </g>
    <g className="scene-sparkle" stroke="#b48b72" strokeWidth="2.2" strokeLinecap="round">
      <path d="M44 110v14m-7-7h14"/>
      <path d="M255 70v14m-7-7h14"/>
      <path d="M148 45v10m-5-5h10"/>
    </g>
  </svg>;
}
