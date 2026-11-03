from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.dashboard_layout import DashboardLayout
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.dashboard_summary_owner import DashboardSummaryOwner
  from ..models.filter_share_type_0 import FilterShareType0
  from ..models.filter_share_type_1 import FilterShareType1
  from ..models.filter_share_type_2 import FilterShareType2
  from ..models.filter_share_type_3 import FilterShareType3





T = TypeVar("T", bound="DashboardSummary")



@_attrs_define
class DashboardSummary:
    """ 
        Attributes:
            id (UUID):
            name (str):
            description (str):
            layout (DashboardLayout):
            owner (DashboardSummaryOwner):
            shares (list[FilterShareType0 | FilterShareType1 | FilterShareType2 | FilterShareType3]):
            favourite (bool):
            home (bool):
            editable (bool):
            updated_at (datetime.datetime):
     """

    id: UUID
    name: str
    description: str
    layout: DashboardLayout
    owner: DashboardSummaryOwner
    shares: list[FilterShareType0 | FilterShareType1 | FilterShareType2 | FilterShareType3]
    favourite: bool
    home: bool
    editable: bool
    updated_at: datetime.datetime





    def to_dict(self) -> dict[str, Any]:
        from ..models.dashboard_summary_owner import DashboardSummaryOwner # noqa: PLC0415
        from ..models.filter_share_type_0 import FilterShareType0 # noqa: PLC0415
        from ..models.filter_share_type_1 import FilterShareType1 # noqa: PLC0415
        from ..models.filter_share_type_2 import FilterShareType2 # noqa: PLC0415
        from ..models.filter_share_type_3 import FilterShareType3 # noqa: PLC0415
        id = str(self.id)

        name = self.name

        description = self.description

        layout = self.layout.value

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

        home = self.home

        editable = self.editable

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "layout": layout,
            "owner": owner,
            "shares": shares,
            "favourite": favourite,
            "home": home,
            "editable": editable,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.dashboard_summary_owner import DashboardSummaryOwner # noqa: PLC0415
        from ..models.filter_share_type_0 import FilterShareType0 # noqa: PLC0415
        from ..models.filter_share_type_1 import FilterShareType1 # noqa: PLC0415
        from ..models.filter_share_type_2 import FilterShareType2 # noqa: PLC0415
        from ..models.filter_share_type_3 import FilterShareType3 # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        description = d.pop("description")

        layout = DashboardLayout(d.pop("layout"))




        owner = DashboardSummaryOwner.from_dict(d.pop("owner"))




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

        home = d.pop("home")

        editable = d.pop("editable")

        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))




        dashboard_summary = cls(
            id=id,
            name=name,
            description=description,
            layout=layout,
            owner=owner,
            shares=shares,
            favourite=favourite,
            home=home,
            editable=editable,
            updated_at=updated_at,
        )

        return dashboard_summary

