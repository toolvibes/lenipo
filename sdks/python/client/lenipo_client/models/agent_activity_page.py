from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.agent_activity import AgentActivity





T = TypeVar("T", bound="AgentActivityPage")



@_attrs_define
class AgentActivityPage:
    """ 
        Attributes:
            entries (list[AgentActivity]):
            next_ (datetime.datetime | None):
     """

    entries: list[AgentActivity]
    next_: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.agent_activity import AgentActivity # noqa: PLC0415
        entries = []
        for entries_item_data in self.entries:
            entries_item = entries_item_data.to_dict()
            entries.append(entries_item)



        next_: None | str
        if isinstance(self.next_, datetime.datetime):
            next_ = self.next_.isoformat()
        else:
            next_ = self.next_


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "entries": entries,
            "next": next_,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.agent_activity import AgentActivity # noqa: PLC0415
        d = dict(src_dict)
        entries = []
        _entries = d.pop("entries")
        for entries_item_data in (_entries):
            entries_item = AgentActivity.from_dict(entries_item_data)



            entries.append(entries_item)


        def _parse_next_(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                next_type_0 = datetime.datetime.fromisoformat(data)



                return next_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        next_ = _parse_next_(d.pop("next"))


        agent_activity_page = cls(
            entries=entries,
            next_=next_,
        )

        return agent_activity_page

