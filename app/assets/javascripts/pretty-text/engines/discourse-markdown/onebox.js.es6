import { lookupCache } from 'pretty-text/oneboxer';
import { cachedInlineOnebox } from 'pretty-text/inline-oneboxer';

const ONEBOX = 1;
const INLINE = 2;

function applyOnebox(state, silent) {
  if (silent || !state.tokens) {
    return;
  }

  for(let i=1;i<state.tokens.length;i++) {
    let token = state.tokens[i];
    let prev = state.tokens[i-1];
    let prevAccepted =  prev.type === "paragraph_open" && prev.level === 0;
    let mode = prevAccepted ? ONEBOX : INLINE;

    if (token.type === "inline" && prevAccepted) {

      let children = token.children;
      for(let j=0;j<children.length-2;j++){
        let child = children[j];

        if (child.type === "link_open" && child.markup === 'linkify' && child.info === 'auto') {

          if (j > children.length-3) {
            continue;
          }

          if (j === 0 && token.leading_space) {
            mode = INLINE;
          } else if (j > 0) {
            let prevSibling = children[j-1];
            if (prevSibling.tag !== 'br' || prevSibling.leading_space) {
              mode = INLINE;
            }
          }

          // look ahead for soft or hard break
          let text = children[j+1];
          let close = children[j+2];
          let lookahead = children[j+3];

          if (lookahead && lookahead.tag !== 'br') {
            mode = INLINE;
          }

          // check attrs only include a href
          let attrs = child.attrs;

          if (!attrs || attrs.length !== 1 || attrs[0][0] !== "href") {
            continue;
          }

          let href = attrs[0][1];

          // edge case ... what if this is not http or protocoless?
          if (!/^http|^\/\//i.test(href)) {
            continue;
          }

          // we already know text matches cause it is an auto link
          if (!close || close.type !== "link_close") {
            continue;
          }

          if (mode === ONEBOX) {
            // we already determined earlier that 0 0 was href
            let cached = lookupCache(attrs[0][1]);

            if (cached) {
              // replace link with 2 blank text nodes and inline html for onebox
              child.type = 'html_raw';
              child.content = cached;
              child.inline = true;

              text.type = 'html_raw';
              text.content = '';
              text.inline = true;

              close.type = 'html_raw';
              close.content = '';
              close.inline = true;

            } else {
              // decorate...
              attrs.push(["class", "onebox"]);
              attrs.push(["target", "_blank"]);
            }
          } else if (mode === INLINE) {
            let onebox = cachedInlineOnebox(href);

            let options = state.md.options.discourse;
            if (options.lookupInlineOnebox) {
              onebox = options.lookupInlineOnebox(href);
            }

            if (onebox) {
              text.content = onebox.title;
            } else if (state.md.options.discourse.previewing) {
              attrs.push(["class", "inline-onebox-loading"]);
            }
          }

        }
      }
    }
  }
}


export function setup(helper) {
  helper.registerPlugin(md => {
    md.core.ruler.after('linkify', 'onebox', applyOnebox);
  });
}
