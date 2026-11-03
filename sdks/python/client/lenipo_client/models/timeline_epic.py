from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.issue_summary import IssueSummary
  from ..models.timeline_epic_progress import TimelineEpicProgress
  from ..models.timeline_row import TimelineRow
  from ..models.timeline_span import TimelineSpan





T = TypeVar("T", bound="TimelineEpic")



@_attrs_define
class TimelineEpic:
    """ 
        Attributes:
            issue (IssueSummary):
            span (None | TimelineSpan):
            progress (TimelineEpicProgress):
            children (list[TimelineRow]):
     """

    issue: IssueSummary
    span: None | TimelineSpan
    progress: TimelineEpicProgress
    children: list[TimelineRow]





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        from ..models.timeline_epic_progress import TimelineEpicProgress # noqa: PLC0415
        from ..models.timeline_row import TimelineRow # noqa: PLC0415
        from ..models.timeline_span import TimelineSpan # noqa: PLC0415
        issue = self.issue.to_dict()

        span: dict[str, Any] | None
        if isinstance(self.span, TimelineSpan):
            span = self.span.to_dict()
        else:
            span = self.span

        progress = self.progress.to_dict()

        children = []
        for children_item_data in self.children:
            children_item = children_item_data.to_dict()
            children.append(children_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "issue": issue,
            "span": span,
            "progress": progress,
            "children": children,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_summary import IssueSummary # noqa: PLC0415
        from ..models.timeline_epic_progress import TimelineEpicProgress # noqa: PLC0415
        from ..models.timeline_row import TimelineRow # noqa: PLC0415
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


        progress = TimelineEpicProgress.from_dict(d.pop("progress"))




        children = []
        _children = d.pop("children")
        for children_item_data in (_children):
            children_item = TimelineRow.from_dict(children_item_data)



            children.append(children_item)


        timeline_epic = cls(
            issue=issue,
            span=span,
            progress=progress,
            children=children,
        )

        return timeline_epic

