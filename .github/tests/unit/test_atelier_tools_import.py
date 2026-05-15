"""API process must load atelier tools without optional google-adk / google-genai deps."""


def test_atelier_tools_import_without_adk():
    from atelier_tools.tools import init_tools, set_patron_context

    init_tools([], [], None)
    assert callable(init_tools)
    assert callable(set_patron_context)
