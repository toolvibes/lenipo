from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.issue_page_ref_kind import IssuePageRefKind
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.issue_page_ref_space import IssuePageRefSpace





T = TypeVar("T", bound="IssuePageRef")



@_attrs_define
class IssuePageRef:
    """ 
        Attributes:
            id (UUID):
            title (str):
            space (IssuePageRefSpace):
            kind (IssuePageRefKind):
            published_at (datetime.datetime | None):
     """

    id: UUID
    title: str
    space: IssuePageRefSpace
    kind: IssuePageRefKind
    published_at: datetime.datetime | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_page_ref_space import IssuePageRefSpace # noqa: PLC0415
        id = str(self.id)

        title = self.title

        space = self.space.to_dict()

        kind = self.kind.value

        published_at: None | str
        if isinstance(self.published_at, datetime.datetime):
            published_at = self.published_at.isoformat()
        else:
            published_at = self.published_at


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "title": title,
            "space": space,
            "kind": kind,
            "publishedAt": published_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_page_ref_space import IssuePageRefSpace # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        title = d.pop("title")

        space = IssuePageRefSpace.from_dict(d.pop("space"))




        kind = IssuePageRefKind(d.pop("kind"))




        def _parse_published_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                published_at_type_0 = datetime.datetime.fromisoformat(data)



                return published_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        published_at = _parse_published_at(d.pop("publishedAt"))


        issue_page_ref = cls(
            id=id,
            title=title,
            space=space,
            kind=kind,
            published_at=published_at,
        )

        return issue_page_ref

