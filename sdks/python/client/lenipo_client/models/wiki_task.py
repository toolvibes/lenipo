from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.user_ref import UserRef
  from ..models.wiki_task_page import WikiTaskPage





T = TypeVar("T", bound="WikiTask")



@_attrs_define
class WikiTask:
    """ 
        Attributes:
            page (WikiTaskPage):
            text (str):
            assignees (list[UserRef]):
            due (datetime.date | None):
     """

    page: WikiTaskPage
    text: str
    assignees: list[UserRef]
    due: datetime.date | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.user_ref import UserRef # noqa: PLC0415
        from ..models.wiki_task_page import WikiTaskPage # noqa: PLC0415
        page = self.page.to_dict()

        text = self.text

        assignees = []
        for assignees_item_data in self.assignees:
            assignees_item = assignees_item_data.to_dict()
            assignees.append(assignees_item)



        due: None | str
        if isinstance(self.due, datetime.date):
            due = self.due.isoformat()
        else:
            due = self.due


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "page": page,
            "text": text,
            "assignees": assignees,
            "due": due,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.user_ref import UserRef # noqa: PLC0415
        from ..models.wiki_task_page import WikiTaskPage # noqa: PLC0415
        d = dict(src_dict)
        page = WikiTaskPage.from_dict(d.pop("page"))




        text = d.pop("text")

        assignees = []
        _assignees = d.pop("assignees")
        for assignees_item_data in (_assignees):
            assignees_item = UserRef.from_dict(assignees_item_data)



            assignees.append(assignees_item)


        def _parse_due(data: object) -> datetime.date | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                due_type_0 = datetime.date.fromisoformat(data)



                return due_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.date | None, data)

        due = _parse_due(d.pop("due"))


        wiki_task = cls(
            page=page,
            text=text,
            assignees=assignees,
            due=due,
        )

        return wiki_task

