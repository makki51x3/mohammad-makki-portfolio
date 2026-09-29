/********************************************/
/********************************************/
/* Please ❤ this if you like it! */
/* Follow Me https://codepen.io/designfenix */
/********************************************/
/********************************************/
/**/
/**/
/**/
/**/
/**/
/**/
/**/
/**/
/**/
/**/
/**/
/**/
/**/
/**/

/* =========================================================
   ELEMENTS
========================================================= */

const mainBubble = document.querySelector("#mainParallax");

const secondaryBubble = document.querySelector("#secondaryParallax");

const dropBubble = document.querySelector("#dropParallax");

/* =========================================================
   CONFIG
========================================================= */

/*
 * Número mágico principal.
 *
 * 0.5  = muy suave
 * 1    = normal
 * 1.5  = fuerte
 * 2    = muy fuerte
 */
const PARALLAX_INTENSITY = 0.5;

/*
 * Suavizado.
 *
 * Más bajo = más lento / suave
 * Más alto = más reactivo
 *
 * Recomendado:
 * 0.02 - 0.08
 */
const PARALLAX_SMOOTHNESS = 0.025;

/* =========================================================
   PARALLAX STATE
========================================================= */

let targetX = 0;
let targetY = 0;

let currentX = 0;
let currentY = 0;

/* =========================================================
   POINTER
========================================================= */

window.addEventListener("pointermove", (event) => {
	const normalizedX = event.clientX / window.innerWidth - 0.5;

	const normalizedY = event.clientY / window.innerHeight - 0.5;

	/*
	 * Movimiento base.
	 *
	 * Antes:
	 * X = 180
	 * Y = 130
	 *
	 * Ahora PARALLAX_INTENSITY controla todo.
	 */

	targetX = normalizedX * 180 * PARALLAX_INTENSITY;

	targetY = normalizedY * 130 * PARALLAX_INTENSITY;
});

/* =========================================================
   MOUSE LEAVE
========================================================= */

document.documentElement.addEventListener("mouseleave", () => {
	targetX = 0;
	targetY = 0;
});

/* =========================================================
   ANIMATION LOOP
========================================================= */

function render() {
	/* -----------------------------------------
     Smooth interpolation
  ----------------------------------------- */

	currentX += (targetX - currentX) * PARALLAX_SMOOTHNESS;

	currentY += (targetY - currentY) * PARALLAX_SMOOTHNESS;

	/* -----------------------------------------
     MAIN
  ----------------------------------------- */

	mainBubble.style.transform = `translate(
      ${currentX}px,
      ${currentY}px
    )`;

	/* -----------------------------------------
     SECONDARY
  ----------------------------------------- */

	secondaryBubble.style.transform = `translate(
      ${currentX * 1.55}px,
      ${currentY * 1.55}px
    )`;

	/* -----------------------------------------
     DROP
  ----------------------------------------- */

	dropBubble.style.transform = `translate(
      ${currentX * 2.15}px,
      ${currentY * 2.15}px
    )`;

	requestAnimationFrame(render);
}

render();
