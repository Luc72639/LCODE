// ========================================
// LOADER GLOBAL - CLÍNICA VIDA+
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const loader = document.querySelector("#page-loader");

    if (!loader) {
        return;
    }

    // Esconde o loader quando a página terminou de carregar
    window.addEventListener("load", () => {

        loader.classList.add("hidden");

    });

    // Intercepta links internos
    const links = document.querySelectorAll("a");

    links.forEach((link) => {

        link.addEventListener("click", (event) => {

            const destino = link.getAttribute("href");

            // Ignora links especiais
            if (
                !destino ||
                destino.startsWith("#") ||
                destino.startsWith("http") ||
                destino.startsWith("mailto:")
            ) {
                return;
            }

            // Mostra o loader antes de mudar de página
            loader.classList.remove("hidden");

        });

    });

});