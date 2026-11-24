"""Unit tests for personality configs and AgentFactory (006)."""

from app.agents.factory import AgentFactory, load_personalities


def test_personalities_yaml_loads_all_roles():
    specs = load_personalities()
    expected = {"explorer", "moderator", "scholar", "advocate", "critic", "judge"}
    assert expected.issubset(specs.keys())
    assert specs["explorer"].trait == "openness"
    assert specs["moderator"].trait == "agreeableness"
    assert specs["scholar"].trait == "conscientiousness"
    assert specs["advocate"].trait == "extraversion"
    assert specs["critic"].trait == "neuroticism"


def test_agent_factory_prompt_includes_role_and_personality():
    factory = AgentFactory(profile="groq")
    agents = factory.create_debate_agents(all_roles=True)
    roles = {a.role for a in agents}
    assert {"moderator", "advocate", "scholar", "explorer", "critic", "judge"} <= roles

    critic = next(a for a in agents if a.role == "critic")
    prompt = factory.get_system_prompt(critic)
    assert "Critic" in prompt
    assert "Neuroticism" in prompt
    assert "Doubt every unverified claim" in prompt

    scholar = next(a for a in agents if a.role == "scholar")
    scholar_prompt = factory.get_system_prompt(scholar)
    assert "Scholar" in scholar_prompt
    assert "Conscientiousness" in scholar_prompt
    assert scholar.stance.upper() in scholar_prompt
