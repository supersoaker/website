import React from 'https://esm.sh/react@18.3.1';
import ReactDOM from 'https://esm.sh/react-dom@18.3.1/client';
import htm from 'https://esm.sh/htm@3.1.1';
import * as lucide from 'https://esm.sh/lucide-react@0.460.0?deps=react@18.3.1';

const html = htm.bind(React.createElement);

export { React, ReactDOM, html, lucide };
