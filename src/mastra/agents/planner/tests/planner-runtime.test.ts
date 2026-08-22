
import { plannerAgent as planner } from "../agent";
import { runPlanner } from "../runtime/planner-runtime";


async function main() {
  const result = await runPlanner(planner, {
    objective:
      "Ajouter Google OAuth et GitHub OAuth à notre application existante sans casser l'authentification actuelle, avec tests d'intégration et préparation du déploiement.",
    constraints: [
      "L'authentification actuelle doit continuer de fonctionner.",
      "Aucune régression ne doit être introduite.",
    ],
  });

  console.dir(result, { depth: null });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});