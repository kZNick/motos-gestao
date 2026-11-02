import { swatchBackground } from '../../../shared/colors.mjs';
export function ColorSwatch({colors,large=false}){return <span aria-hidden="true" className={'paint-swatch'+(large?' paint-swatch-large':'')} style={{background:swatchBackground(colors)}}/>;}
