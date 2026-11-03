from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.activity_entry_kind import ActivityEntryKind
from ..types import UNSET, Unset
from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.activity_entry_issue import ActivityEntryIssue
  from ..models.activity_entry_items_item import ActivityEntryItemsItem
  from ..models.activity_entry_project import ActivityEntryProject
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="ActivityEntry")



@_attrs_define
class ActivityEntry:
    """ 
        Attributes:
            id (str):
            kind (ActivityEntryKind):
            actor (None | UserRef):
            issue (ActivityEntryIssue):
            project (ActivityEntryProject):
            items (list[ActivityEntryItemsItem]):
            at (datetime.datetime):
            excerpt (str | Unset):
     """

    id: str
    kind: ActivityEntryKind
    actor: None | UserRef
    issue: ActivityEntryIssue
    project: ActivityEntryProject
    items: list[ActivityEntryItemsItem]
    at: datetime.datetime
    excerpt: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        from ..models.activity_entry_issue import ActivityEntryIssue # noqa: PLC0415
        from ..models.activity_entry_items_item import ActivityEntryItemsItem # noqa: PLC0415
        from ..models.activity_entry_project import ActivityEntryProject # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = self.id

        kind = self.kind.value

        actor: dict[str, Any] | None
        if isinstance(self.actor, UserRef):
            actor = self.actor.to_dict()
        else:
            actor = self.actor

        issue = self.issue.to_dict()

        project = self.project.to_dict()

        items = []
        for items_item_data in self.items:
            items_item = items_item_data.to_dict()
            items.append(items_item)



        at = self.at.isoformat()

        excerpt = self.excerpt


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "kind": kind,
            "actor": actor,
            "issue": issue,
            "project": project,
            "items": items,
            "at": at,
        })
        if excerpt is not UNSET:
            field_dict["excerpt"] = excerpt

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.activity_entry_issue import ActivityEntryIssue # noqa: PLC0415
        from ..models.activity_entry_items_item import ActivityEntryItemsItem # noqa: PLC0415
        from ..models.activity_entry_project import ActivityEntryProject # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = d.pop("id")

        kind = ActivityEntryKind(d.pop("kind"))




        def _parse_actor(data: object) -> None | UserRef:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                actor_type_0 = UserRef.from_dict(data)



                return actor_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UserRef, data)

        actor = _parse_actor(d.pop("actor"))


        issue = ActivityEntryIssue.from_dict(d.pop("issue"))




        project = ActivityEntryProject.from_dict(d.pop("project"))




        items = []
        _items = d.pop("items")
        for items_item_data in (_items):
            items_item = ActivityEntryItemsItem.from_dict(items_item_data)



            items.append(items_item)


        at = datetime.datetime.fromisoformat(d.pop("at"))




        excerpt = d.pop("excerpt", UNSET)

        activity_entry = cls(
            id=id,
            kind=kind,
            actor=actor,
            issue=issue,
            project=project,
            items=items,
            at=at,
            excerpt=excerpt,
        )

        return activity_entry

