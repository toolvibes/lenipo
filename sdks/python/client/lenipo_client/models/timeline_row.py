from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.issue_summary import IssueSummary
  from ..models.timeline_span import TimelineSpan





T = TypeVar("T", bound="TimelineRow")



@_attrs_define
class TimelineRow:
    """ 
        Attributes:
            issue (IssueSummary):
            span (None | TimelineSpan):
     """

    issue: IssueSummary
    span: None | TimelineSpan





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        from ..models.timeline_span import TimelineSpan # noqa: PLC0415
        issue = self.issue.to_dict()

        span: dict[str, Any] | None
        if isinstance(self.span, TimelineSpan):
            span = self.span.to_dict()
        else:
            span = self.span


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issue": issue,
            "span": span,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        from ..models.timeline_span import TimelineSpan # noqa: PLC0415
        d = dict(src_dict)
        issue = IssueSummary.from_dict(d.pop("issue"))




        def _parse_span(data: object) -> None | TimelineSpan:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                span_type_0 = TimelineSpan.from_dict(data)



                return span_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | TimelineSpan, data)

        span = _parse_span(d.pop("span"))


        timeline_row = cls(
            issue=issue,
            span=span,
        )

        return timeline_row

