"""Tests for CHART_SPEC parsing in the chat protocol."""

import json
import pytest

from services.chat_protocol import (
    _extract_chart_specs,
    build_chart_instruction,
    is_chart_request,
)


class TestExtractChartSpecs:
    def test_single_chart_spec(self):
        text = 'Here is your chart.\nCHART_SPEC:{"chartType":"bar","title":"Sales","xAxis":"Quarter","yAxis":"Revenue","data":[{"Quarter":"Q1","Revenue":100}]}'
        cleaned, charts = _extract_chart_specs(text)

        assert len(charts) == 1
        assert charts[0]["chartType"] == "bar"
        assert charts[0]["title"] == "Sales"
        assert charts[0]["xAxis"] == "Quarter"
        assert charts[0]["yAxis"] == "Revenue"
        assert len(charts[0]["data"]) == 1
        assert charts[0]["data"][0]["Quarter"] == "Q1"
        assert "id" in charts[0]  # UUID was added
        assert "CHART_SPEC" not in cleaned
        assert "Here is your chart." in cleaned

    def test_no_chart_spec(self):
        text = "This is just a normal response with no chart."
        cleaned, charts = _extract_chart_specs(text)

        assert len(charts) == 0
        assert cleaned == text

    def test_chart_spec_with_surrounding_text(self):
        text = 'Analysis: Revenue grew 50%.\n\nCHART_SPEC:{"chartType":"line","title":"Growth","xAxis":"Month","yAxis":"Revenue","data":[{"Month":"Jan","Revenue":100},{"Month":"Feb","Revenue":150}]}\n\nHope this helps!'
        cleaned, charts = _extract_chart_specs(text)

        assert len(charts) == 1
        assert charts[0]["chartType"] == "line"
        assert "Analysis: Revenue grew 50%." in cleaned
        assert "Hope this helps!" in cleaned
        assert "CHART_SPEC" not in cleaned

    def test_multiple_chart_specs(self):
        text = (
            'First chart:\nCHART_SPEC:{"chartType":"bar","title":"Bar","xAxis":"x","yAxis":"y","data":[{"x":"a","y":1}]}\n'
            'Second chart:\nCHART_SPEC:{"chartType":"pie","title":"Pie","xAxis":"name","yAxis":"value","data":[{"name":"A","value":10}]}'
        )
        cleaned, charts = _extract_chart_specs(text)

        assert len(charts) == 2
        assert charts[0]["chartType"] == "bar"
        assert charts[1]["chartType"] == "pie"
        assert "CHART_SPEC" not in cleaned

    def test_chart_spec_with_array_yaxis(self):
        text = 'CHART_SPEC:{"chartType":"bar","title":"Multi","xAxis":"Q","yAxis":["Rev","Profit"],"data":[{"Q":"Q1","Rev":100,"Profit":20}]}'
        cleaned, charts = _extract_chart_specs(text)

        assert len(charts) == 1
        assert charts[0]["yAxis"] == ["Rev", "Profit"]

    def test_invalid_json_skipped(self):
        text = 'CHART_SPEC:{invalid json here} and some more text'
        cleaned, charts = _extract_chart_specs(text)

        # Invalid JSON should be skipped gracefully
        assert len(charts) == 0

    def test_chart_spec_with_whitespace(self):
        text = 'Here:\nCHART_SPEC: {"chartType":"bar","title":"Test","xAxis":"x","yAxis":"y","data":[{"x":"a","y":1}]}'
        cleaned, charts = _extract_chart_specs(text)

        assert len(charts) == 1
        assert charts[0]["title"] == "Test"

    def test_pie_chart_data(self):
        text = 'CHART_SPEC:{"chartType":"pie","title":"Distribution","xAxis":"Category","yAxis":"Amount","data":[{"Category":"A","Amount":30},{"Category":"B","Amount":70}]}'
        cleaned, charts = _extract_chart_specs(text)

        assert len(charts) == 1
        assert charts[0]["chartType"] == "pie"
        assert len(charts[0]["data"]) == 2
        total = sum(d["Amount"] for d in charts[0]["data"])
        assert total == 100

    def test_chart_request_detection(self):
        assert is_chart_request("Create a chart of STARLIMS status distribution")
        assert is_chart_request(
            "请生成2026 年 5 月份数据以每周为单位的数据可视化图片"
        )
        assert not is_chart_request("Summarize STARLIMS status distribution")

    def test_chart_instruction_accepts_agent_tool_rows(self):
        instruction = build_chart_instruction(
            [
                {
                    "label": "agent tool 'may_status_distribution'",
                    "rows": [
                        {"current_status": "Prelogged", "tasks": 84, "pct": 52.8},
                        {"current_status": "Logged", "tasks": 50, "pct": 31.4},
                    ],
                }
            ]
        )

        assert "CHART_SPEC:" in instruction
        assert "available data" in instruction
        assert "may_status_distribution" in instruction
        assert '"current_status": "Prelogged"' in instruction
        assert '"tasks": 84' in instruction
