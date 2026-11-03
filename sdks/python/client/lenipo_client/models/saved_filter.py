from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.filter_share_type_0 import FilterShareType0
  from ..models.filter_share_type_1 import FilterShareType1
  from ..models.filter_share_type_2 import FilterShareType2
  from ..models.filter_share_type_3 import FilterShareType3
  from ..models.user_ref import UserRef





T = TypeVar("T", bound="SavedFilter")



@_attrs_define
class SavedFilter:
    """ 
        Attributes:
            id (UUID):
            name (str):
            description (str):
            query (str):
            owner (UserRef):
            shares (list[FilterShareType0 | FilterShareType1 | FilterShareType2 | FilterShareType3]):
            favourite (bool):
            editable (bool):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
     """

    id: UUID
    name: str
    description: str
    query: str
    owner: UserRef
    shares: list[FilterShareType0 | FilterShareType1 | FilterShareType2 | FilterShareType3]
    favourite: bool
    editable: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        from ..models.filter_share_type_0 import FilterShareType0 # noqa: PLC0415
        from ..models.filter_share_type_1 import FilterShareType1 # noqa: PLC0415
        from ..models.filter_share_type_2 import FilterShareType2 # noqa: PLC0415
        from ..models.filter_share_type_3 import FilterShareType3 # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        id = str(self.id)

        name = self.name

        description = self.description

        query = self.query

        owner = self.owner.to_dict()

        shares = []
        for shares_item_data in self.shares:
            shares_item: dict[str, Any]
            if isinstance(shares_item_data, FilterShareType0):
                shares_item = shares_item_data.to_dict()
            elif isinstance(shares_item_data, FilterShareType1):
                shares_item = shares_item_data.to_dict()
            elif isinstance(shares_item_data, FilterShareType2):
                shares_item = shares_item_data.to_dict()
            else:
                shares_item = shares_item_data.to_dict()

            shares.append(shares_item)



        favourite = self.favourite

        editable = self.editable

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "query": query,
            "owner": owner,
            "shares": shares,
            "favourite": favourite,
            "editable": editable,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.filter_share_type_0 import FilterShareType0 # noqa: PLC0415
        from ..models.filter_share_type_1 import FilterShareType1 # noqa: PLC0415
        from ..models.filter_share_type_2 import FilterShareType2 # noqa: PLC0415
        from ..models.filter_share_type_3 import FilterShareType3 # noqa: PLC0415
        from ..models.user_ref import UserRef # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        description = d.pop("description")

        query = d.pop("query")

        owner = UserRef.from_dict(d.pop("owner"))




        shares = []
        _shares = d.pop("shares")
        for shares_item_data in (_shares):
            def _parse_shares_item(data: object) -> FilterShareType0 | FilterShareType1 | FilterShareType2 | FilterShareType3:
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_filter_share_type_0 = FilterShareType0.from_dict(data)



                    return componentsschemas_filter_share_type_0
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_filter_share_type_1 = FilterShareType1.from_dict(data)



                    return componentsschemas_filter_share_type_1
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    componentsschemas_filter_share_type_2 = FilterShareType2.from_dict(data)



                    return componentsschemas_filter_share_type_2
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_filter_share_type_3 = FilterShareType3.from_dict(data)



                return componentsschemas_filter_share_type_3

            shares_item = _parse_shares_item(shares_item_data)

            shares.append(shares_item)


        favourite = d.pop("favourite")

        editable = d.pop("editable")

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))




        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        saved_filter = cls(
            id=id,
            name=name,
            description=description,
            query=query,
            owner=owner,
            shares=shares,
            favourite=favourite,
            editable=editable,
            created_at=created_at,
            updated_at=updated_at,
        )

        return saved_filter

