{
  description = "tobby — keyboard-driven IRC client for the terminal";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        pname = "tobby";
        version = "0.2.7"; # @nix-version
        src = pkgs.fetchurl {
          url = "https://registry.npmjs.org/@mattfillipe/tobby/-/tobby-${version}.tgz";
          hash = "sha256-cpN/GPKhRjYvnYsaIrEtWb07WXmd44Km3EeZumGlH48="; # @nix-hash
        };
      in
      {
        packages.default = pkgs.stdenv.mkDerivation {
          inherit pname version src;

          nativeBuildInputs = [ pkgs.makeWrapper ];

          # npm tarballs always extract to a `package/` directory
          unpackPhase = ''
            tar -xzf $src
          '';

          dontBuild = true;

          installPhase = ''
            mkdir -p $out/lib/tobby
            cp -r package/dist $out/lib/tobby/dist
            makeWrapper ${pkgs.bun}/bin/bun $out/bin/tobby \
              --add-flags "$out/lib/tobby/dist/index.js"
          '';

          meta = with pkgs.lib; {
            description = "Keyboard-driven IRC client for the terminal";
            homepage = "https://github.com/ObsidianIRC/tobby";
            license = licenses.gpl3Only;
            mainProgram = "tobby";
            platforms = platforms.unix;
          };
        };

        apps.default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/tobby";
        };
      });
}
